import { ManifestationItem, ProgressLog } from '@/store';
import { Affirmation, RampageSet, SuccessStory } from '@/types';

export const WORST_CASE_MANIFESTATIONS: ManifestationItem[] = [
  {
    id: 'manif_worst_1',
    userId: 'facu',
    author: 'Aleksandra Wiśniewska-Kowalczyk',
    title:
      'Benachrichtigungseinstellungen und Systemüberwachungsberichte für Enterprise-Infrastruktur <script>alert("XSS")</script>',
    description:
      'A very long unstructured intention without breaks: https://example.com/workspaces/acme/projects/q3-launch/docs/9f8e7d6c5b4a?tab=comments&filter=unresolved_items_with_extremely_long_parameters_that_never_wrap_and_stretch_viewport_bounds',
    sensoryAnchor:
      'Đặng Thị Ngọc Hân — Siento el aroma a café recién molido bajo la lluvia torrencial con 🦊 Fox y 👩🏽‍💻 Priya',
    status: 'semilla',
    createdAt: '2026-11-08T22:00:00.000Z',
    updatedAt: '2026-11-08T22:00:00.000Z',
    songAttachment: {
      id: 'spotify:track:worst1',
      title:
        'The Most Unbreakable Track Title That Refuses To Wrap Anywhere In The User Interface',
      artist: 'Bartholomew Fitzgerald & The Northwind Symphony Orchestra',
      albumCoverUrl: 'https://example.com/404-broken-image.jpg',
      spotifyUrl: 'javascript:alert("XSS_TRIGGERED")',
      previewAudioUrl: null,
      providerTrackId: 'worst1',
    },
    mediaAttachment: null,
  },
  {
    id: 'manif_worst_2',
    userId: 'facu',
    author: 'J',
    title: 'Jo',
    description: '   ',
    sensoryAnchor: '',
    status: 'materializado',
    createdAt: '1970-01-01T00:00:00.000Z',
    updatedAt: '1970-01-01T00:00:00.000Z',
    songAttachment: null,
    mediaAttachment: {
      kind: 'photo',
      thumbDataUrl:
        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="800"><rect fill="%23e11d48" width="10" height="800"/></svg>',
      mimeType: 'image/svg+xml',
      width: 10,
      height: 800,
      storageKey: 'media_test_2',
      byteSize: 42000,
    },
  },
  {
    id: 'manif_worst_3',
    userId: 'facu',
    author: 'نور الهدى عبد الرحمن',
    title: '王秀英 創造した現実の調和と無限の豊かさ',
    description: 'Line 1\n\n\n\nLine 2 with \t tabs & special "characters" <b onmouseover=alert(1)>hover</b>',
    sensoryAnchor: "Seán O'Brien-Ó Súilleabháin",
    status: 'alineacion',
    createdAt: 'invalid-date-format',
    updatedAt: 'invalid-date-format',
    songAttachment: null,
    mediaAttachment: null,
  },
];

export const WORST_CASE_AFFIRMATIONS: Affirmation[] = [
  {
    id: 'aff_worst_1',
    userId: 'facu',
    author: 'Christopher Alexander Montgomery III',
    text: 'https://example.com/very/long/unbreakable/path/to/affirmation/asset/manifestation?token=9f8e7d6c5b4a4c3d8e2f1a0b9c8d7e6f_unbreakable_text_that_should_wrap',
    repeatCount: 1,
    pinned: true,
    order: 0,
    createdAt: '2026-11-08T21:00:00.000Z',
  },
  {
    id: 'aff_worst_2',
    userId: 'facu',
    author: ' ',
    text: 'Benachrichtigungseinstellungen <img src=x onerror=alert(1)>',
    repeatCount: 0,
    pinned: true,
    order: 1,
    createdAt: '2026-11-08T21:10:00.000Z',
  },
  {
    id: 'aff_worst_3',
    userId: 'facu',
    author: '🦊 Fox',
    text: 'Đặng Thị Ngọc Hân — Soy la calma infinita y mi mente trasciende cualquier límite preconcebido en este plano físico.',
    repeatCount: 1000000,
    pinned: false,
    order: 2,
    createdAt: '2026-11-08T21:20:00.000Z',
  },
  {
    id: 'aff_worst_4',
    userId: 'facu',
    author: 'نور الهدى',
    text: 'Jo',
    repeatCount: -1,
    pinned: false,
    order: 3,
    createdAt: '2026-11-08T21:30:00.000Z',
  },
];

export const WORST_CASE_PROGRESS_LOGS: ProgressLog[] = [
  {
    id: 'prog_worst_1',
    manifestationId: 'manif_worst_1',
    userId: 'facu',
    note: 'bartholomew.fitzgerald@northwind-industries-holdings.example.com confirmó la alineación.\nDetalles adicionales sin espacios: https://company.internal/deep/link/that/overflows/the/grid/column/width/and/causes/horizontal/jitter',
    signType: 'angel_number',
    createdAt: '2026-11-08T14:30:00Z',
  },
  {
    id: 'prog_worst_2',
    manifestationId: 'manif_worst_2',
    userId: 'facu',
    note: 'SupercalifragilisticexpialidociousSynchronicitySeenTodayWithoutAnySpaceInTheStringAtAll',
    signType: 'dream',
    createdAt: 'invalid-date',
  },
  {
    id: 'prog_worst_3',
    manifestationId: 'manif_worst_3',
    userId: 'facu',
    note: '111',
    signType: 'unknown_sign_fallback' as any,
    createdAt: '1970-01-01T00:00:00Z',
  },
];

export const WORST_CASE_SUCCESS_STORIES: SuccessStory[] = [
  {
    id: 'story_worst_1',
    manifestationId: 'manif_worst_1',
    userId: 'facu',
    author: 'Aleksandra Wiśniewska-Kowalczyk',
    title:
      'Benachrichtigungseinstellungen manifestadas exitosamente en tiempo récord con <b onmouseover=alert(1)>bold</b>',
    story:
      'A 2,500 character narrative text test:\n' +
      'El universo conspiró a nuestro favor en cada detalle minúsculo y preciso sin dejar nada al azar. '.repeat(
        35
      ),
    manifestedDate: '2099-12-31',
    createdAt: '2026-11-08T20:00:00Z',
  },
  {
    id: 'story_worst_2',
    manifestationId: 'manif_worst_2',
    userId: 'facu',
    author: 'Jo',
    title: 'X',
    story: 'Short',
    manifestedDate: '0000-00-00',
    createdAt: '2026-11-08T20:10:00Z',
  },
];

export const ONE_ITEM_MANIFESTATION: ManifestationItem = {
  id: 'manif_one_1',
  userId: 'facu',
  author: 'Facu',
  title: 'Mi única intención activa',
  description: 'Verificando diseño con exactamente 1 elemento en la cuadrícula.',
  status: 'semilla',
  createdAt: '2026-11-08T12:00:00Z',
  updatedAt: '2026-11-08T12:00:00Z',
};

export const ONE_ITEM_AFFIRMATION: Affirmation = {
  id: 'aff_one_1',
  userId: 'facu',
  author: 'Facu',
  text: 'Todo fluye con perfecta sincronía.',
  repeatCount: 1,
  pinned: true,
  order: 0,
  createdAt: '2026-11-08T12:00:00Z',
};

export const ONE_ITEM_PROGRESS: ProgressLog = {
  id: 'prog_one_1',
  manifestationId: 'manif_one_1',
  userId: 'facu',
  note: 'Primera señal confirmada',
  signType: 'coincidence',
  createdAt: '2026-11-08T12:00:00Z',
};

export const ONE_ITEM_STORY: SuccessStory = {
  id: 'story_one_1',
  manifestationId: 'manif_one_1',
  userId: 'facu',
  author: 'Facu',
  title: 'Primer éxito individual',
  story: 'Se cumplió la única manifestación registrada.',
  manifestedDate: '2026-11-08',
  createdAt: '2026-11-08T12:00:00Z',
};

export function generateThousandAffirmations(): Affirmation[] {
  return Array.from({ length: 1000 }, (_, i) => ({
    id: `aff_thousand_${i}`,
    userId: 'facu',
    author: `Usuario ${i % 10}`,
    text: `Afirmación masiva #${i + 1}: Manifiesto abundancia infinita, claridad mental y paz.`,
    repeatCount: i,
    pinned: i < 3,
    order: i,
    createdAt: new Date(Date.now() - i * 60000).toISOString(),
  }));
}

export function generateThousandManifestations(): ManifestationItem[] {
  return Array.from({ length: 1000 }, (_, i) => ({
    id: `manif_thousand_${i}`,
    userId: 'facu',
    author: `Facu ${i}`,
    title: `Intención a gran escala #${i + 1}`,
    description: `Descripción detallada de la intención número ${i + 1} para probar rendimiento del listado y límites de renderizado.`,
    status: (['semilla', 'alineacion', 'evidencia', 'materializado'] as const)[i % 4],
    createdAt: new Date(Date.now() - i * 120000).toISOString(),
    updatedAt: new Date(Date.now() - i * 120000).toISOString(),
  }));
}
