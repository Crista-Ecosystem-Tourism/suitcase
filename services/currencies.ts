export const POPULAR_CURRENCIES = [
    { code: 'RUB', symbol: '₽', name: 'Russian Ruble' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'THB', symbol: '฿', name: 'Thai Baht' },
    { code: 'GEL', symbol: '₾', name: 'Georgian Lari' },
    { code: 'AMD', symbol: '֏', name: 'Armenian Dram' },
    { code: 'KZT', symbol: '₸', name: 'Kazakhstani Tenge' },
    { code: 'BYN', symbol: 'Br', name: 'Belarusian Ruble' },
    { code: 'CHF', symbol: '₣', name: 'Swiss Franc' },
    { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
    { code: 'KRW', symbol: '₩', name: 'South Korean Won' },
    { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah' },
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
    { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar' },
];

export const getCurrencySymbol = (code: string) => {
    return POPULAR_CURRENCIES.find(c => c.code === code)?.symbol || code;
};

// API: https://api.exchangerate-api.com/v4/latest/RUB
export const fetchExchangeRates = async (base: string = 'RUB'): Promise<Record<string, number>> => {
    try {
        const response = await fetch(`https://api.exchangerate-api.com/v4/latest/${base}`);
        const data = await response.json();
        return data.rates;
    } catch (error) {
        console.error('Error fetching rates:', error);
        // Fallback rates if offline/error
        return {
            'RUB': 1,
            'USD': 0.011,
            'EUR': 0.010,
            'GBP': 0.0085,
            'CNY': 0.078,
            'TRY': 0.35,
            'THB': 0.39,
        };
    }
};

export const convertCurrency = (amount: number, from: string, to: string, rates: Record<string, number>) => {
    if (!from || !to || from === to) return amount;

    // If we have rates relative to RUB (as base)
    // baseAmount = amount / rates[from] (this gives RUB amount)
    // result = baseAmount * rates[to]

    const fromRate = rates[from];
    const toRate = rates[to];

    if (!fromRate || !toRate) return amount;

    const inBase = amount / fromRate;
    return inBase * toRate;
};
