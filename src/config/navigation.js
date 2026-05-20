import { ROLE_GROUPS } from '@/constants/roles';

export const NAVIGATION_ITEMS = [
    {
        name: 'Home',
        routeName: 'Home',
        icon: 'el-icon-s-home'
        // Home is for all logged in users
    },
    {
        name: 'My Interviews',
        routeName: 'MyInterviews',
        icon: 'el-icon-chat-line-square',
        allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    },
    {
        name: 'My Transcriptions',
        routeName: 'TranscriptionsView',
        icon: 'el-icon-microphone',
        allowedRoles: ROLE_GROUPS.TRANSCRIPTION_ACCESS
    },
    {
        name: 'Profile Settings',
        routeName: 'ProfileSettings',
        icon: 'el-icon-user',
        allowedRoles: ROLE_GROUPS.ALL_AUTHORIZED
    },
    {
        name: 'System Status',
        routeName: 'AdminStatus',
        icon: 'el-icon-monitor',
        allowedRoles: ROLE_GROUPS.STAFF
    },
    {
        name: 'Voice AI (Beta)',
        routeName: 'VoiceAI',
        icon: 'el-icon-headset',
        allowedRoles: ROLE_GROUPS.STAFF
    }
];
