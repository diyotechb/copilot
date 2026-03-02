import { ROLE_GROUPS } from '@/constants/roles';

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
        allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    },
    {
        name: 'Transcriptions',
        routeName: 'TranscriptionsView',
        icon: 'el-icon-microphone',
        allowedRoles: ROLE_GROUPS.STAFF
    }
];
