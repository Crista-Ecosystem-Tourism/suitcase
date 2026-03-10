import { DaDataApiKey } from '../constants/Config';

export interface Suggestion {
    value: string;
    data: {
        city?: string;
        country?: string;
        geo_lat?: string;
        geo_lon?: string;
    };
}

export const getCitySuggestions = async (query: string): Promise<Suggestion[]> => {
    if (!DaDataApiKey) return [];

    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${DaDataApiKey}`
            },
            body: JSON.stringify({
                query,
                from_bound: { value: "city" },
                to_bound: { value: "city" }
            })
        });

        const data = await response.json();
        return data.suggestions || [];
    } catch (error) {
        console.error('DaData error:', error);
        return [];
    }
};

export const getCountrySuggestions = async (query: string): Promise<Suggestion[]> => {
    if (!DaDataApiKey) return [];

    try {
        const response = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/country', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Authorization': `Token ${DaDataApiKey}`
            },
            body: JSON.stringify({ query })
        });

        const data = await response.json();
        return data.suggestions || [];
    } catch (error) {
        console.error('DaData error:', error);
        return [];
    }
};
