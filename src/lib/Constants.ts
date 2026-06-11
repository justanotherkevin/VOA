function mobileTabletCheck() {
	// https://stackoverflow.com/questions/11381673/detecting-a-mobile-browser
	let check = false;
	((a: string) => {
		if (
			/(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino|android|ipad|playbook|silk/i.test(
				a,
			) ||
			/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(
				a.substr(0, 4),
			)
		)
			check = true;
	})(
		navigator.userAgent ||
			navigator.vendor ||
			('opera' in window && typeof window.opera === 'string'
				? window.opera
				: ''),
	);
	return check;
}
const isMobileOrTablet = mobileTabletCheck();

export default {
	SAMPLING_RATE: 16000,
	DEFAULT_AUDIO_URL: `https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/${
		isMobileOrTablet ? 'jfk' : 'ted_60_16k'
	}.wav`,
	DEFAULT_MODEL: 'Xenova/whisper-tiny',
	DEFAULT_SUBTASK: 'transcribe',
	DEFAULT_LANGUAGE: 'english',
	DEFAULT_QUANTIZED: isMobileOrTablet,
	DEFAULT_MULTILINGUAL: false,
};

export const DEFAULT_MODEL_PREFERENCES = {
	selectedModel: 'Xenova/whisper-tiny',
	multilingual: false,
	quantized: false,
	language: 'english',
};

export const DEFAULT_MODELS = {
	audio2text: 'Xenova/flan-t5-small',
	text2text: 'Xenova/flan-t5-base',
	text2summary: 'Xenova/distilbart-cnn-6-6',
	text2structuredSummary: 'onnx-community/Qwen2.5-1.5B-Instruct',
};

// List of supported languages:
// https://help.openai.com/en/articles/7031512-whisper-api-faq
// https://github.com/openai/whisper/blob/248b6cb124225dd263bb9bd32d060b6517e067f8/whisper/tokenizer.py#L79
export const LANGUAGES = {
	en: 'english',
	zh: 'chinese',
	de: 'german',
	es: 'spanish/castilian',
	ru: 'russian',
	ko: 'korean',
	fr: 'french',
	ja: 'japanese',
	pt: 'portuguese',
	tr: 'turkish',
	pl: 'polish',
	ca: 'catalan/valencian',
	nl: 'dutch/flemish',
	ar: 'arabic',
	sv: 'swedish',
	it: 'italian',
	id: 'indonesian',
	hi: 'hindi',
	fi: 'finnish',
	vi: 'vietnamese',
	he: 'hebrew',
	uk: 'ukrainian',
	el: 'greek',
	ms: 'malay',
	cs: 'czech',
	ro: 'romanian/moldavian/moldovan',
	da: 'danish',
	hu: 'hungarian',
	ta: 'tamil',
	no: 'norwegian',
	th: 'thai',
	ur: 'urdu',
	hr: 'croatian',
	bg: 'bulgarian',
	lt: 'lithuanian',
	la: 'latin',
	mi: 'maori',
	ml: 'malayalam',
	cy: 'welsh',
	sk: 'slovak',
	te: 'telugu',
	fa: 'persian',
	lv: 'latvian',
	bn: 'bengali',
	sr: 'serbian',
	az: 'azerbaijani',
	sl: 'slovenian',
	kn: 'kannada',
	et: 'estonian',
	mk: 'macedonian',
	br: 'breton',
	eu: 'basque',
	is: 'icelandic',
	hy: 'armenian',
	ne: 'nepali',
	mn: 'mongolian',
	bs: 'bosnian',
	kk: 'kazakh',
	sq: 'albanian',
	sw: 'swahili',
	gl: 'galician',
	mr: 'marathi',
	pa: 'punjabi/panjabi',
	si: 'sinhala/sinhalese',
	km: 'khmer',
	sn: 'shona',
	yo: 'yoruba',
	so: 'somali',
	af: 'afrikaans',
	oc: 'occitan',
	ka: 'georgian',
	be: 'belarusian',
	tg: 'tajik',
	sd: 'sindhi',
	gu: 'gujarati',
	am: 'amharic',
	yi: 'yiddish',
	lo: 'lao',
	uz: 'uzbek',
	fo: 'faroese',
	ht: 'haitian creole/haitian',
	ps: 'pashto/pushto',
	tk: 'turkmen',
	nn: 'nynorsk',
	mt: 'maltese',
	sa: 'sanskrit',
	lb: 'luxembourgish/letzeburgesch',
	my: 'myanmar/burmese',
	bo: 'tibetan',
	tl: 'tagalog',
	mg: 'malagasy',
	as: 'assamese',
	tt: 'tatar',
	haw: 'hawaiian',
	ln: 'lingala',
	ha: 'hausa',
	ba: 'bashkir',
	jw: 'javanese',
	su: 'sundanese',
};

export const MODEL_META_DATA = [
	{
		name: 'Tiny',
		size: '~75MB',
		model: 'Xenova/whisper-tiny',
		isEnglishOnly: true,
		speed: 4,
		accuracy: 2,
		details: 'Fastest model, ideal for quick transcriptions and resource-constrained environments',
	},
	{
		name: 'Base',
		size: '~142MB',
		model: 'Xenova/whisper-base',
		isEnglishOnly: true,
		speed: 3,
		accuracy: 3,
		details: 'Balanced model optimized for English, good balance between speed and accuracy',
	},
	{
		name: 'Small',
		size: '~466MB',
		model: 'Xenova/whisper-small',
		isEnglishOnly: true,
		speed: 2,
		accuracy: 3,
		details: 'Improved accuracy with moderate performance, good for general-purpose use',
	},
	{
		name: 'Medium',
		size: '~1.5GB',
		model: 'Xenova/whisper-medium',
		isEnglishOnly: true,
		speed: 1,
		accuracy: 4,
		details: 'Highest accuracy model, best for critical transcription tasks',
	},
];

export const CACHED_MODEL_META: Record<string, { subtitle: string; description: string }> = {
	'Qwen2.5-1.5B-Instruct': {
		subtitle: 'AI summaries · ~900 MB',
		description: "Alibaba's Qwen 2.5 1.5B runs fully on-device to generate structured summaries, decisions, topics, and action items after each meeting.",
	},
	'distilbart-cnn-6-6': {
		subtitle: 'for text summary',
		description: "A distilled version of Facebook's BART model, fine-tuned on CNN/DailyMail news articles for abstractive summarization. Generates a short summary of your transcript. The \"6-6\" means 6 encoder layers + 6 decoder layers (the full BART-large has 12+12).",
	},
	'flan-t5-base': {
		subtitle: 'for style transfer',
		description: "Google's FLAN-T5 base model, instruction-tuned on a large mixture of tasks. Used for rewriting transcripts into different tones or formats (e.g. formal, bullet points).",
	},
	'whisper-tiny': {
		subtitle: 'for transcription · fastest',
		description: "OpenAI's smallest Whisper model (~75 MB). Optimized for speed on resource-constrained devices; lower accuracy on accents and background noise.",
	},
	'whisper-tiny.en': {
		subtitle: 'for transcription · fastest (English only)',
		description: 'English-only variant of Whisper Tiny. Slightly more accurate than the multilingual tiny for English speech at the same speed.',
	},
	'whisper-base': {
		subtitle: 'for transcription · fast',
		description: "OpenAI's Whisper base model (~142 MB). A good balance between speed and accuracy for clear English speech.",
	},
	'whisper-base.en': {
		subtitle: 'for transcription · fast (English only)',
		description: 'English-only variant of Whisper Base. More accurate than the multilingual base for English-only content.',
	},
	'whisper-small': {
		subtitle: 'for transcription · balanced',
		description: "OpenAI's Whisper small model (~466 MB). Noticeably better accuracy than base, especially for accents and noisy audio, at moderate speed.",
	},
	'whisper-small.en': {
		subtitle: 'for transcription · balanced (English only)',
		description: 'English-only variant of Whisper Small. Best accuracy-to-speed ratio for English-only use cases.',
	},
	'whisper-medium': {
		subtitle: 'for transcription · accurate',
		description: "OpenAI's Whisper medium model (~1.5 GB). High accuracy across languages and accents; significantly slower than small.",
	},
	'whisper-medium.en': {
		subtitle: 'for transcription · accurate (English only)',
		description: 'English-only variant of Whisper Medium. Top accuracy for English at the cost of longer processing time.',
	},
};

export const DOCS_PATHS = {
	WHISPER_CONFIG: 'docs/whisper-config.md',
	FLAN_T5_GUIDE: 'docs/FLAN-T5_STYLE_TRANSFER_GUIDE.md',
	SUMMARIZATION: 'docs/summarization.md',
	TEXT2TEXT_GENERATION: 'docs/text2text-generation.md',
};
