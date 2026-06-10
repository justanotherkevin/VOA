import React from 'react';
import { Card, CardContent } from '@/renderer/components/card';
import { Button } from '@/renderer/components/button';
import { usePermissions } from '@/renderer/hooks/usePermissions';
import { RotateCw, Keyboard, Mic, Accessibility, Monitor } from 'lucide-react';

interface PermissionItem {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const PERMISSIONS: PermissionItem[] = [
  {
    id: 'keyboardShortcut',
    title: 'Keyboard Shortcut',
    description: 'Set up a keyboard shortcut to use VoiceInk anywhere',
    icon: <Keyboard size={24} />,
  },
  {
    id: 'microphone',
    title: 'Microphone Access',
    description: 'Allow VoiceInk to record your voice for transcription',
    icon: <Mic size={24} />,
  },
  {
    id: 'accessibility',
    title: 'Accessibility Access',
    description:
      'Allow VoiceInk to paste transcribed text directly at your cursor position',
    icon: <Accessibility size={24} />,
  },
  {
    id: 'screenRecording',
    title: 'Screen Recording Access',
    description:
      'Allow VoiceInk to understand context from your screen for transcript enhancement',
    icon: <Monitor size={24} />,
  },
];

export default function Permissions() {
  const {
    permissions,
    isLoading,
    error,
    refreshError,
    openSettingsError,
    refresh,
    refreshPermission,
    openSettings,
  } = usePermissions();

  const getPermissionStatus = (permissionId: string): boolean => {
    const value = permissions[permissionId as keyof typeof permissions];
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value === 'granted';
    return false;
  };

  const handleRefreshPermission = async (permissionId: string) => {
    await refreshPermission(permissionId);
  };

  const handleOpenSettings = async (permissionId: string) => {
    if (permissionId === 'microphone') {
      await openSettings('microphone');
    } else if (permissionId === 'accessibility') {
      await openSettings('accessibility');
    } else if (permissionId === 'screenRecording') {
      await openSettings('screenRecording');
    }
  };

  if (isLoading) {
    return (
      <div className="w-full h-full overflow-auto flex items-center justify-center">
        <div className="text-gray-600">Loading permissions...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-auto">
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Permissions</h1>
          <p className="text-gray-600 mt-2">
            VoiceInk requires the following permissions to function properly
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {refreshError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Error refreshing permissions: {refreshError}
          </div>
        )}

        {openSettingsError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            Error opening settings: {openSettingsError}
          </div>
        )}

        <div className="space-y-4">
          {PERMISSIONS.map((permission) => {
            const isGranted = getPermissionStatus(permission.id);
            return (
              <Card
                key={permission.id}
                className="border-0 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => handleOpenSettings(permission.id)}
              >
                <CardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="p-3 bg-green-100 rounded-full text-green-600">
                      {permission.icon}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">
                        {permission.title}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">
                        {permission.description}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 ml-4">
                    {isGranted ? (
                      <div className="text-green-600">
                        <svg
                          className="w-6 h-6"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    ) : (
                      <div className="text-gray-400">
                        <svg
                          className="w-6 h-6"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRefreshPermission(permission.id);
                      }}
                      className="h-10 w-10"
                      title="Refresh permission status"
                    >
                      <RotateCw size={18} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <p>
            Click on any permission card to open System Settings and grant the
            required permission. Use the refresh button to check if the
            permission has been granted.
          </p>
        </div>
      </div>
    </div>
  );
}
