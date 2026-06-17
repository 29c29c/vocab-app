let xlsxLoadingPromise = null;

export function loadXlsxLibrary() {
    if (window.XLSX) {
        return Promise.resolve(window.XLSX);
    }

    if (xlsxLoadingPromise) {
        return xlsxLoadingPromise;
    }

    xlsxLoadingPromise = import('xlsx')
        .then(module => {
            const xlsx = module.default || module;
            window.XLSX = xlsx;
            return xlsx;
        })
        .catch(error => {
            xlsxLoadingPromise = null;
            throw new Error(`Excel 组件加载失败: ${error.message}`);
        });

    return xlsxLoadingPromise;
}
