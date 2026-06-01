import { escapeHtml } from './utils.js';

const PSGC_API_BASE_URL = 'https://psgc.gitlab.io/api';
const ADDRESS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const LOCAL_ADDRESS_DATASET_URL = 'https://raw.githubusercontent.com/flores-jacob/philippine-regions-provinces-cities-municipalities-barangays/refs/heads/master/philippine_provinces_cities_municipalities_and_barangays_2019v2.json';
const LOCAL_ADDRESS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

let addressPickerSource = 'psgc';
let localAddressDataset = null;
let localProvinceIndex = null;

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

async function fetchJsonWithCache(url, cacheKey, maxAgeMs = ADDRESS_CACHE_TTL_MS) {
    const now = Date.now();
    const rawCache = (() => {
        try {
            return localStorage.getItem(cacheKey);
        } catch {
            return null;
        }
    })();

    if (rawCache) {
        const cached = safeJsonParse(rawCache);
        if (cached && typeof cached === 'object' && cached.timestamp && cached.data) {
            if (now - cached.timestamp < maxAgeMs) {
                return cached.data;
            }
        }
    }

    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load address data (${response.status}).`);
    }

    const data = await response.json();

    try {
        localStorage.setItem(cacheKey, JSON.stringify({ timestamp: now, data }));
    } catch {
        // Ignore cache write errors (e.g., quota exceeded).
    }

    return data;
}

function buildLocalProvinceIndex(dataset) {
    const index = new Map();

    if (!dataset || typeof dataset !== 'object') {
        return index;
    }

    Object.keys(dataset).forEach((regionKey) => {
        if (regionKey === 'NCR') {
            return;
        }

        const provinceList = dataset?.[regionKey]?.province_list;
        if (!provinceList || typeof provinceList !== 'object') {
            return;
        }

        Object.keys(provinceList).forEach((provinceName) => {
            if (!index.has(provinceName)) {
                index.set(provinceName, { regionKey, provinceName });
            }
        });
    });

    return index;
}

async function loadLocalAddressDataset() {
    if (localAddressDataset) {
        return localAddressDataset;
    }

    const dataset = await fetchJsonWithCache(
        LOCAL_ADDRESS_DATASET_URL,
        'local:phAddressDataset:2019v2',
        LOCAL_ADDRESS_CACHE_TTL_MS,
    );

    localAddressDataset = dataset;
    localProvinceIndex = buildLocalProvinceIndex(dataset);
    return dataset;
}

async function getLocalProvinceOptions() {
    await loadLocalAddressDataset();

    const provinceNames = Array.from((localProvinceIndex || new Map()).keys())
        .sort((a, b) => String(a).localeCompare(String(b)));

    return provinceNames.map((provinceName) => ({
        value: String(provinceName),
        label: String(provinceName),
    }));
}

function getLocalNcrCityOptions(dataset) {
    const citySet = new Set();
    const districtList = dataset?.NCR?.province_list;

    if (!districtList || typeof districtList !== 'object') {
        return [];
    }

    Object.keys(districtList).forEach((districtName) => {
        const municipalityList = districtList?.[districtName]?.municipality_list;
        if (!municipalityList || typeof municipalityList !== 'object') {
            return;
        }

        Object.keys(municipalityList).forEach((cityName) => {
            citySet.add(cityName);
        });
    });

    return Array.from(citySet)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .map((cityName) => ({
            value: String(cityName),
            label: String(cityName),
        }));
}

async function getLocalCitiesMunicipalitiesOptions(provinceSelectionValue) {
    const dataset = await loadLocalAddressDataset();
    const selectionValue = String(provinceSelectionValue || '');

    if (selectionValue.startsWith('region:')) {
        return getLocalNcrCityOptions(dataset);
    }

    const provinceEntry = localProvinceIndex?.get(selectionValue);
    if (!provinceEntry) {
        return [];
    }

    const municipalityList = dataset?.[provinceEntry.regionKey]?.province_list?.[provinceEntry.provinceName]?.municipality_list;
    if (!municipalityList || typeof municipalityList !== 'object') {
        return [];
    }

    return Object.keys(municipalityList)
        .sort((a, b) => String(a).localeCompare(String(b)))
        .map((cityName) => ({
            value: String(cityName),
            label: String(cityName),
        }));
}

async function getLocalBarangayOptions(provinceSelectionValue, cityOrMunicipalityName) {
    const dataset = await loadLocalAddressDataset();
    const selectionValue = String(provinceSelectionValue || '');
    const cityName = String(cityOrMunicipalityName || '');

    let barangays = [];

    if (selectionValue.startsWith('region:')) {
        const districtList = dataset?.NCR?.province_list;
        if (districtList && typeof districtList === 'object') {
            for (const districtName of Object.keys(districtList)) {
                const entry = districtList?.[districtName]?.municipality_list?.[cityName];
                if (entry && Array.isArray(entry.barangay_list)) {
                    barangays = entry.barangay_list;
                    break;
                }
            }
        }
    } else {
        const provinceEntry = localProvinceIndex?.get(selectionValue);
        const entry = dataset?.[provinceEntry?.regionKey]?.province_list?.[provinceEntry?.provinceName]?.municipality_list?.[cityName];
        if (entry && Array.isArray(entry.barangay_list)) {
            barangays = entry.barangay_list;
        }
    }

    return (barangays || [])
        .slice()
        .sort((a, b) => String(a).localeCompare(String(b)))
        .map((barangayName) => ({
            value: String(barangayName),
            label: String(barangayName),
        }));
}

function setSelectOptions(selectElement, options, placeholderLabel) {
    if (!selectElement) {
        return;
    }

    const placeholder = `<option value="">${escapeHtml(placeholderLabel)}</option>`;
    selectElement.innerHTML = placeholder + (options || [])
        .map((option) => `<option value="${escapeHtml(option.value)}">${escapeHtml(option.label)}</option>`)
        .join('');
}

function setAddressControlsDisabled({ provinceSelect, cityMunicipalitySelect, barangaySelect }, isDisabled) {
    if (provinceSelect) {
        provinceSelect.disabled = isDisabled;
    }
    if (cityMunicipalitySelect) {
        cityMunicipalitySelect.disabled = isDisabled;
    }
    if (barangaySelect) {
        barangaySelect.disabled = isDisabled;
    }
}

function setAddressControlsRequired({ provinceSelect, cityMunicipalitySelect, barangaySelect }, isRequired) {
    const applyRequired = (element) => {
        if (!element) {
            return;
        }

        if (isRequired) {
            element.setAttribute('required', 'required');
        } else {
            element.removeAttribute('required');
        }
    };

    applyRequired(provinceSelect);
    applyRequired(cityMunicipalitySelect);
    applyRequired(barangaySelect);
}

function showShippingError(message) {
    const messageBox = document.getElementById('shippingMessage');
    if (!messageBox) {
        return;
    }

    messageBox.textContent = message;
    messageBox.classList.remove('hidden');
}

function hideShippingError() {
    const messageBox = document.getElementById('shippingMessage');
    if (!messageBox) {
        return;
    }

    messageBox.textContent = '';
    messageBox.classList.add('hidden');
}

async function loadProvinces() {
    const url = `${PSGC_API_BASE_URL}/provinces.json`;
    return fetchJsonWithCache(url, 'psgc:provinces');
}

async function loadCitiesMunicipalities(provinceCode) {
    const safeProvinceCode = encodeURIComponent(String(provinceCode || '').trim());
    const url = `${PSGC_API_BASE_URL}/provinces/${safeProvinceCode}/cities-municipalities.json`;
    return fetchJsonWithCache(url, `psgc:province:${safeProvinceCode}:citiesMunicipalities`);
}

async function loadCitiesMunicipalitiesForRegion(regionCode) {
    const safeRegionCode = encodeURIComponent(String(regionCode || '').trim());
    const url = `${PSGC_API_BASE_URL}/regions/${safeRegionCode}/cities-municipalities.json`;
    return fetchJsonWithCache(url, `psgc:region:${safeRegionCode}:citiesMunicipalities`);
}

async function loadBarangays(cityOrMunicipalityCode) {
    const safeCode = encodeURIComponent(String(cityOrMunicipalityCode || '').trim());
    const cityUrl = `${PSGC_API_BASE_URL}/cities/${safeCode}/barangays.json`;
    const municipalityUrl = `${PSGC_API_BASE_URL}/municipalities/${safeCode}/barangays.json`;

    try {
        return await fetchJsonWithCache(cityUrl, `psgc:city:${safeCode}:barangays`);
    } catch {
        return fetchJsonWithCache(municipalityUrl, `psgc:municipality:${safeCode}:barangays`);
    }
}

export async function initPhilippinesAddressPicker(defaultValues = {}) {
    const provinceSelect = document.getElementById('shippingProvince');
    const cityMunicipalitySelect = document.getElementById('shippingCityMunicipality');
    const barangaySelect = document.getElementById('shippingBarangay');

    if (!provinceSelect || !cityMunicipalitySelect || !barangaySelect) {
        return;
    }

    const controls = { provinceSelect, cityMunicipalitySelect, barangaySelect };
    hideShippingError();
    setAddressControlsDisabled(controls, true);
    setAddressControlsRequired(controls, true);

    setSelectOptions(provinceSelect, [], 'Loading provinces...');
    setSelectOptions(cityMunicipalitySelect, [], 'Select your city / municipality');
    setSelectOptions(barangaySelect, [], 'Select your barangay');

    let provinceOptions = [];
    addressPickerSource = 'psgc';

    try {
        const provinces = await loadProvinces();
        provinceOptions = (provinces || [])
            .map((province) => ({
                value: String(province.code || ''),
                label: String(province.name || 'Unknown'),
            }))
            .sort((a, b) => a.label.localeCompare(b.label));
    } catch {
        addressPickerSource = 'local';
        try {
            provinceOptions = await getLocalProvinceOptions();
        } catch {
            setSelectOptions(provinceSelect, [], 'Province list unavailable');
            setSelectOptions(cityMunicipalitySelect, [], 'City / municipality list unavailable');
            setSelectOptions(barangaySelect, [], 'Barangay list unavailable');
            setAddressControlsDisabled(controls, true);
            setAddressControlsRequired(controls, false);
            showShippingError('Unable to load the PH address dropdowns right now. You can still continue by typing your full address in “House No. and Street”.');
            return;
        }
    }

    provinceOptions.unshift({
        value: 'region:130000000',
        label: 'Metro Manila (NCR)',
    });

    const populateBarangays = async (cityOrMunicipalityCode, preferredBarangayCode = '') => {
        hideShippingError();
        setSelectOptions(barangaySelect, [], cityOrMunicipalityCode ? 'Loading barangays...' : 'Select your barangay');

        if (!cityOrMunicipalityCode) {
            barangaySelect.disabled = true;
            return;
        }

        barangaySelect.disabled = true;

        try {
            let options = [];

            if (addressPickerSource === 'local') {
                options = await getLocalBarangayOptions(provinceSelect.value, cityOrMunicipalityCode);
            } else {
                const barangays = await loadBarangays(cityOrMunicipalityCode);
                options = (barangays || [])
                    .map((item) => ({
                        value: String(item.code || ''),
                        label: String(item.name || 'Unknown'),
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label));
            }

            setSelectOptions(barangaySelect, options, 'Select your barangay');
            barangaySelect.disabled = false;

            if (preferredBarangayCode && options.some((option) => option.value === preferredBarangayCode)) {
                barangaySelect.value = preferredBarangayCode;
            }
        } catch {
            setSelectOptions(barangaySelect, [], 'Barangay list unavailable');
            barangaySelect.disabled = true;
            showShippingError('Unable to load barangays for that city/municipality.');
        }
    };

    const populateCitiesMunicipalities = async (provinceSelectionValue, preferredCityMunicipalityCode = '', preferredBarangayCode = '') => {
        hideShippingError();
        setSelectOptions(cityMunicipalitySelect, [], provinceSelectionValue ? 'Loading cities / municipalities...' : 'Select your city / municipality');
        setSelectOptions(barangaySelect, [], 'Select your barangay');

        if (!provinceSelectionValue) {
            cityMunicipalitySelect.disabled = true;
            barangaySelect.disabled = true;
            return;
        }

        cityMunicipalitySelect.disabled = true;
        barangaySelect.disabled = true;

        try {
            let options = [];

            if (addressPickerSource === 'local') {
                options = await getLocalCitiesMunicipalitiesOptions(provinceSelectionValue);
            } else {
                let citiesMunicipalities;
                if (provinceSelectionValue.startsWith('region:')) {
                    citiesMunicipalities = await loadCitiesMunicipalitiesForRegion(provinceSelectionValue.slice('region:'.length));
                } else {
                    citiesMunicipalities = await loadCitiesMunicipalities(provinceSelectionValue);
                }

                options = (citiesMunicipalities || [])
                    .map((item) => ({
                        value: String(item.code || ''),
                        label: String(item.name || 'Unknown'),
                    }))
                    .sort((a, b) => a.label.localeCompare(b.label));
            }

            setSelectOptions(cityMunicipalitySelect, options, 'Select your city / municipality');
            cityMunicipalitySelect.disabled = false;

            if (preferredCityMunicipalityCode && options.some((option) => option.value === preferredCityMunicipalityCode)) {
                cityMunicipalitySelect.value = preferredCityMunicipalityCode;
                await populateBarangays(preferredCityMunicipalityCode, preferredBarangayCode);
            }
        } catch {
            setSelectOptions(cityMunicipalitySelect, [], 'City / municipality list unavailable');
            cityMunicipalitySelect.disabled = true;
            showShippingError('Unable to load cities/municipalities for that province.');
        }
    };

    setSelectOptions(provinceSelect, provinceOptions, 'Select your province');
    setSelectOptions(cityMunicipalitySelect, [], 'Select your city / municipality');
    setSelectOptions(barangaySelect, [], 'Select your barangay');

    setAddressControlsDisabled({ provinceSelect }, false);

    provinceSelect.addEventListener('change', async () => {
        await populateCitiesMunicipalities(provinceSelect.value);
    });

    cityMunicipalitySelect.addEventListener('change', async () => {
        await populateBarangays(cityMunicipalitySelect.value);
    });

    cityMunicipalitySelect.disabled = true;
    barangaySelect.disabled = true;

    if (defaultValues.provinceCode && provinceOptions.some((option) => option.value === defaultValues.provinceCode)) {
        provinceSelect.value = defaultValues.provinceCode;
        await populateCitiesMunicipalities(
            defaultValues.provinceCode,
            String(defaultValues.cityMunicipalityCode || ''),
            String(defaultValues.barangayCode || ''),
        );
    }
}
