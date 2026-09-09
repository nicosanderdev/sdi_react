import { Label, TextInput, Textarea } from 'flowbite-react';
import {
  LOCALIZED_LANGUAGES,
  LOCALIZED_LANGUAGE_LABELS,
  type LocalizedLanguage,
  type LocalizedTextByLanguage,
} from '../../../models/properties/localizedText';

interface LocalizedTitleDescriptionFieldsProps {
  idPrefix: string;
  title: LocalizedTextByLanguage;
  description: LocalizedTextByLanguage;
  onTitleChange: (next: LocalizedTextByLanguage) => void;
  onDescriptionChange: (next: LocalizedTextByLanguage) => void;
  titleMaxLength?: number;
  descriptionMaxLength?: number;
  titleRequired?: boolean;
}

export function LocalizedTitleDescriptionFields({
  idPrefix,
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  titleMaxLength = 120,
  descriptionMaxLength = 2000,
}: LocalizedTitleDescriptionFieldsProps) {
  const setTitle = (lang: LocalizedLanguage, text: string) => {
    const next = { ...title };
    if (text.trim()) next[lang] = text;
    else delete next[lang];
    onTitleChange(next);
  };

  const setDescription = (lang: LocalizedLanguage, text: string) => {
    const next = { ...description };
    if (text.trim()) next[lang] = text;
    else delete next[lang];
    onDescriptionChange(next);
  };

  return (
    <div className="space-y-4">
      {LOCALIZED_LANGUAGES.map(lang => (
        <div key={lang} className="rounded-md border border-gray-100 dark:border-gray-700 p-3 space-y-3">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {LOCALIZED_LANGUAGE_LABELS[lang]}
          </p>
          <div>
            <Label htmlFor={`${idPrefix}-title-${lang}`}>Título</Label>
            <TextInput
              id={`${idPrefix}-title-${lang}`}
              className="mt-1"
              maxLength={titleMaxLength}
              placeholder="Título"
              value={title[lang] ?? ''}
              onChange={e => setTitle(lang, e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`${idPrefix}-desc-${lang}`}>Descripción</Label>
            <Textarea
              id={`${idPrefix}-desc-${lang}`}
              className="mt-1"
              rows={2}
              maxLength={descriptionMaxLength}
              placeholder="Descripción (opcional)"
              value={description[lang] ?? ''}
              onChange={e => setDescription(lang, e.target.value)}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
