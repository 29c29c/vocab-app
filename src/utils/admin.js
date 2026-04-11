export function isAdminUsername(username, config) {
    if (!username || !config?.adminUsernames) {
        return false;
    }

    return config.adminUsernames.includes(username);
}
