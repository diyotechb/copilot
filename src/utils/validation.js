export const REGEX = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    UPPERCASE: /[A-Z]/,
    LOWERCASE: /[a-z]/,
    NUMBER: /[0-9]/,
    SPECIAL: /[\^$*.[\]{}()?\-"!@#%&\/\\,><':;|_~`+=]|(?!^)\s(?!$)/
};

export const validateEmail = (email) => {
    return email && REGEX.EMAIL.test(email);
};

export const validatePassword = (password) => {
    if (!password || password.length < 8) return false;

    return REGEX.UPPERCASE.test(password) &&
        REGEX.LOWERCASE.test(password) &&
        REGEX.NUMBER.test(password) &&
        REGEX.SPECIAL.test(password);
};

export const validateMinLength = (str, len) => {
    return str && str.length >= len;
};
