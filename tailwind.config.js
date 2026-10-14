import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        extend: {
            colors: {
                indigo: { 50: '#edf5f1', 100: '#deeee6', 200: '#bedbcd', 300: '#91bda8', 400: '#58a284', 500: '#318e70', 600: '#187f68', 700: '#126452', 800: '#164f41', 900: '#203e34', 950: '#142b23' }
            }
        },
    },
    plugins: [
        typography,
    ],
};
