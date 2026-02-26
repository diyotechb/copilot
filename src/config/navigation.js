export const NAVIGATION_ITEMS = [
    {
        name: 'Home',
        routeName: 'Home',
        icon: 'el-icon-s-home'
        // Home is for all logged in users
    },
    {
        name: 'Practice Setup',
        routeName: 'ResumeSetup',
        icon: 'el-icon-notebook-2',
        allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP', 'COPILOT_USER', 'DIYO_EXTERNAL']
    },
    {
        name: 'Transcriptions',
        routeName: 'TranscriptionsView',
        icon: 'el-icon-microphone',
        allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIYO_EMP']
    }
];
