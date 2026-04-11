let xlsxLoadingPromise = null;

export function loadXlsxLibrary() {
    if (window.XLSX) {
        return Promise.resolve(window.XLSX);
    }

    if (xlsxLoadingPromise) {
        return xlsxLoadingPromise;
    }

    xlsxLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
        script.async = true;
        script.onload = () => resolve(window.XLSX);
        script.onerror = () => reject(new Error('Excel 组件加载失败'));
        document.body.appendChild(script);
    });

    return xlsxLoadingPromise;
}
