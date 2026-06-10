import React, { useState, useCallback } from 'react';
import { Card, CardContent } from '@/renderer/components/card';
import { Button } from '@/renderer/components/button';
import type { Transcriber } from '@/renderer/hooks/useTranscriber';
import { useModelPreferences } from '@/renderer/hooks/useModelPreferences';
import { MODEL_META_DATA } from '@/lib/Constants';
import { Globe, HardDrive, Download, Check } from 'lucide-react';

interface CachedModel {
  name: string;
  size: number;
  path: string;
}

interface AIModelProps {
  transcriber: Transcriber;
}

export default function AIModel({ transcriber }: AIModelProps) {
  const {
    preferences,
    isLoading: isLoadingPreferences,
    updatePreferences,
  } = useModelPreferences();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [selectedAsrType, setSelectedAsrType] = useState<
    'whisper' | 'parakeet'
  >('whisper');
  const [isSavingModel, setIsSavingModel] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [cachedModels, setCachedModels] = useState<CachedModel[]>([]);
  const [isLoadingCache, setIsLoadingCache] = useState(false);
  const [isDeletingModel, setIsDeletingModel] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'recommended' | 'downloaded'>(
    'recommended',
  );

  // Sync selectedModel and asrType with preferences when they load
  React.useEffect(() => {
    if (preferences?.selectedModel) {
      setSelectedModel(preferences.selectedModel);
    }
    if (preferences?.asrType) {
      setSelectedAsrType(preferences.asrType);
    }
  }, [preferences]);

  const loadCachedModels = useCallback(async () => {
    try {
      setIsLoadingCache(true);
      const result = await window.electronAPI.settings.model.cache.list();
      if (result?.success && result.models) {
        setCachedModels(result.models);
      }
    } catch (error) {
      console.error('Error loading cached models:', error);
    } finally {
      setIsLoadingCache(false);
    }
  }, []);

  // Load cached models on mount
  React.useEffect(() => {
    loadCachedModels();
  }, [loadCachedModels]);

  const handleDeleteModel = async (modelName: string) => {
    if (
      !window.confirm(
        `Delete ${modelName}? This will free up space but the model will need to be re-downloaded if used again.`,
      )
    ) {
      return;
    }

    try {
      setIsDeletingModel(modelName);
      const result = await window.electronAPI.settings.model.cache.delete(modelName);

      if (result?.success) {
        setSaveMessage({
          type: 'success',
          text: `Deleted ${modelName} successfully`,
        });
        await loadCachedModels();
      } else {
        throw new Error(result?.message || 'Failed to delete model');
      }
    } catch (error) {
      console.error('Error deleting model:', error);
      setSaveMessage({
        type: 'error',
        text: `Failed to delete ${modelName}: ${error}`,
      });
    } finally {
      setIsDeletingModel(null);
    }
  };

  const handleClearAllCache = async () => {
    if (
      !window.confirm(
        `Delete all ${cachedModels.length} cached model(s)? They will need to be re-downloaded if used again.`,
      )
    ) {
      return;
    }

    try {
      setIsLoadingCache(true);
      const result = await window.electronAPI.settings.model.cache.clearAll();

      if (result?.success) {
        setSaveMessage({
          type: 'success',
          text: result.message || 'Cache cleared successfully',
        });
        await loadCachedModels();
      } else {
        throw new Error(result?.message || 'Failed to clear cache');
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      setSaveMessage({
        type: 'error',
        text: `Failed to clear cache: ${error}`,
      });
    } finally {
      setIsLoadingCache(false);
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const getModelDisplayName = (modelPath: string) => {
    const modelSize = MODEL_META_DATA.find((m) => m.model === modelPath);
    return modelSize?.name || 'Tiny';
  };

  const handleModelSelect = (model: string) => {
    setSelectedModel(model);
    setSaveMessage(null);
  };

  const handleSaveModel = async () => {
    if (!selectedModel) return;

    try {
      setIsSavingModel(true);
      setSaveMessage(null);

      // Update preferences in backend store
      const success = await updatePreferences({
        selectedModel,
        asrType: selectedAsrType,
      });

      if (success) {
        console.log(
          '[AIModel] Model updated to:',
          selectedModel,
          'ASR type:',
          selectedAsrType,
        );

        setSaveMessage({
          type: 'success',
          text: 'Settings saved successfully! They will be used for the next transcription.',
        });
      } else {
        throw new Error('Failed to save settings');
      }
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMessage({
        type: 'error',
        text: `Failed to save settings: ${error}`,
      });
    } finally {
      setIsSavingModel(false);
    }
  };

  const renderSpeedDots = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < rating ? 'bg-green-500' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const renderAccuracyDots = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full ${
              i < rating ? 'bg-yellow-400' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>
    );
  };

  const isModelDownloaded = (modelPath: string): boolean => {
    return cachedModels.some((model) =>
      model.name
        .toLowerCase()
        .includes(modelPath.split('/')[1]?.toLowerCase() || ''),
    );
  };

  return (
    <Card className="border-0 mb-6">
      <CardContent className="p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">AI Model</h2>
        <div className="mb-6">
          <p className="text-gray-600 mb-2">
            Current model:{' '}
            <span className="font-medium">
              {preferences?.selectedModel
                ? getModelDisplayName(preferences.selectedModel)
                : 'Loading...'}
            </span>
            {transcriber.isModelLoading ? (
              <span className="text-yellow-600 ml-2">⏳ Loading...</span>
            ) : (
              <span className="text-green-600 ml-2">✓ Ready</span>
            )}
          </p>

          {transcriber.isModelLoading &&
            transcriber.progressItems.length > 0 && (
              <div className="mt-4 space-y-2">
                {transcriber.progressItems.map((item) => (
                  <div key={item.file} className="text-sm">
                    <div className="flex justify-between text-gray-600 mb-1">
                      <span>{item.name}</span>
                      <span>{Math.round(item.progress)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
        </div>

        <div className="mb-6 pb-6 border-b border-gray-200">
          <h3 className="text-md font-semibold text-gray-900 mb-3">
            ASR Engine
          </h3>
          <p className="text-gray-600 mb-4 text-sm">
            Choose the speech recognition engine. Whisper is currently
            supported, Parakeet will be available in Phase 3.
          </p>
          <div className="flex gap-4">
            <Button
              variant={selectedAsrType === 'whisper' ? 'default' : 'outline'}
              className={`h-auto py-3 px-6 flex flex-col items-start justify-center ${
                selectedAsrType === 'whisper'
                  ? 'border-2 border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-2 border-gray-200 bg-white text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => {
                setSelectedAsrType('whisper');
                setSaveMessage(null);
              }}
              disabled={transcriber.isModelLoading || isSavingModel}
            >
              <span className="text-md font-semibold">Whisper</span>
              <span className="text-sm text-gray-500">
                OpenAI ASR (Current)
              </span>
            </Button>
            <Button
              variant="outline"
              className="h-auto py-3 px-6 flex flex-col items-start justify-center border-2 border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed"
              disabled={true}
            >
              <span className="text-md font-semibold">Parakeet</span>
              <span className="text-xs text-gray-400">
                Phase 3 - Coming Soon
              </span>
            </Button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-6 border-b border-gray-200">
          <button
            type="button"
            onClick={() => setActiveTab('recommended')}
            className={`pb-3 px-4 font-medium text-sm transition-colors ${
              activeTab === 'recommended'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Recommended
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('downloaded')}
            className={`pb-3 px-4 font-medium text-sm transition-colors ${
              activeTab === 'downloaded'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Downloaded
          </button>
        </div>

        {/* Recommended Tab */}
        {activeTab === 'recommended' && (
          <div className="space-y-2 ">
            {MODEL_META_DATA.map((modelOption, index) => {
              const isDownloaded = isModelDownloaded(modelOption.model);
              return (
                <div
                  key={modelOption.model}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all text-left w-full ${
                    selectedModel === modelOption.model
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  } ${
                    isDownloaded
                      ? ``
                      : `border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed`
                  }`}
                  onKeyUp={() => handleModelSelect(modelOption.model)}
                  onClick={() => {}}
                  role="tab"
                  tabIndex={index}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {modelOption.name}
                      </h3>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-4 flex items-center gap-2"
                      disabled={
                        isDownloaded ||
                        transcriber.isModelLoading ||
                        isSavingModel
                      }
                    >
                      {isDownloaded ? (
                        <>
                          <Check className="text-green-500" size={16} />
                          Downloaded
                        </>
                      ) : (
                        <>
                          <Download size={16} />
                          Download
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="flex items-start gap-8 mb-3">
                    {modelOption.isEnglishOnly && (
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-gray-600" />
                        <span className="text-sm text-gray-600">
                          English-only
                        </span>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <HardDrive size={16} className="text-gray-600" />
                      <span className="text-sm text-gray-600">
                        {modelOption.size}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-600 mb-1">Speed</div>
                      {renderSpeedDots(modelOption.speed)}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-xs text-gray-600 mb-1">Accuracy</div>
                      {renderAccuracyDots(modelOption.accuracy)}
                    </div>
                  </div>

                  <p className="text-sm text-gray-600">{modelOption.details}</p>
                </div>
              );
            })}

            <div className="flex items-center gap-4 mt-6">
              <Button
                onClick={handleSaveModel}
                disabled={
                  !selectedModel ||
                  (selectedModel === preferences?.selectedModel &&
                    selectedAsrType === preferences?.asrType) ||
                  transcriber.isModelLoading ||
                  isSavingModel ||
                  isLoadingPreferences
                }
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSavingModel ? 'Saving...' : 'Save Settings'}
              </Button>

              {saveMessage && (
                <p
                  className={`text-sm ${
                    saveMessage.type === 'success'
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}
                >
                  {saveMessage.text}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Downloaded Tab */}
        {activeTab === 'downloaded' && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Cached Models ({cachedModels.length})
              </h3>
              {cachedModels.length > 0 && (
                <Button
                  variant="outline"
                  onClick={handleClearAllCache}
                  disabled={isLoadingCache}
                  className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                >
                  Clear All
                </Button>
              )}
            </div>

            {isLoadingCache ? (
              <div className="text-center py-8 text-gray-500">
                Loading cached models...
              </div>
            ) : cachedModels.length === 0 ? (
              <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
                No models downloaded yet. Models will be downloaded on first
                use.
              </div>
            ) : (
              <div className="space-y-3">
                {cachedModels.map((model) => (
                  <div
                    key={model.name}
                    className="flex items-center justify-between p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{model.name}</p>
                      <p className="text-sm text-gray-500">
                        {formatBytes(model.size)}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => handleDeleteModel(model.name)}
                      disabled={isDeletingModel === model.name}
                      className="text-red-600 hover:text-red-700 border-red-300 hover:border-red-400"
                    >
                      {isDeletingModel === model.name
                        ? 'Deleting...'
                        : 'Delete'}
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {cachedModels.length > 0 && (
              <p className="text-xs text-gray-500 mt-4">
                Total cache size:{' '}
                {formatBytes(cachedModels.reduce((sum, m) => sum + m.size, 0))}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
