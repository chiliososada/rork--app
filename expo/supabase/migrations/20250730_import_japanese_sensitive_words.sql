-- Import Japanese Sensitive Words Data
-- Migrates the hardcoded 50 Japanese sensitive words to the database

-- ========== Import Japanese Sensitive Words ==========

-- Using the bulk_import_sensitive_words function to import all words
SELECT bulk_import_sensitive_words('[
  {
    "word": "殺す",
    "category": "violence", 
    "severity": 3,
    "language": "ja",
    "variations": ["ころす", "コロス"],
    "description": "殺害を示唆する暴力的表現"
  },
  {
    "word": "死ね",
    "category": "violence",
    "severity": 3, 
    "language": "ja",
    "variations": ["しね", "シネ"],
    "description": "死を願う暴力的表現"
  },
  {
    "word": "暴力",
    "category": "violence",
    "severity": 2,
    "language": "ja", 
    "variations": ["ぼうりょく", "バイオレンス"],
    "description": "暴力行為を示す表現"
  },
  {
    "word": "殴る",
    "category": "violence",
    "severity": 2,
    "language": "ja",
    "variations": ["なぐる"],
    "description": "物理的暴力を示す表現"
  },
  {
    "word": "蹴る", 
    "category": "violence",
    "severity": 2,
    "language": "ja",
    "variations": ["ける", "ケル"],
    "description": "物理的暴力を示す表現"
  },
  {
    "word": "叩く",
    "category": "violence", 
    "severity": 2,
    "language": "ja",
    "variations": ["たたく", "タタク"],
    "description": "物理的暴力を示す表現"
  },
  {
    "word": "差別",
    "category": "hate",
    "severity": 3,
    "language": "ja",
    "variations": ["さべつ"],
    "description": "差別的表現"
  },
  {
    "word": "バカ",
    "category": "hate", 
    "severity": 1,
    "language": "ja",
    "variations": ["ばか", "馬鹿"],
    "description": "軽度の侮辱表現"
  },
  {
    "word": "アホ",
    "category": "hate",
    "severity": 1, 
    "language": "ja",
    "variations": ["あほ", "阿呆"],
    "description": "軽度の侮辱表現"
  },
  {
    "word": "クズ",
    "category": "hate",
    "severity": 2,
    "language": "ja",
    "variations": ["くず", "屑"],
    "description": "中程度の侮辱表現"
  },
  {
    "word": "ゴミ",
    "category": "hate", 
    "severity": 2,
    "language": "ja",
    "variations": ["ごみ"],
    "description": "中程度の侮辱表現"
  },
  {
    "word": "廃物",
    "category": "hate",
    "severity": 2,
    "language": "ja",
    "variations": ["はいぶつ"],
    "description": "中程度の侮辱表現"
  },
  {
    "word": "エロ",
    "category": "sexual",
    "severity": 2,
    "language": "ja", 
    "variations": ["えろ"],
    "description": "性的な表現"
  },
  {
    "word": "セックス",
    "category": "sexual",
    "severity": 2,
    "language": "ja",
    "variations": ["せっくす"],
    "description": "性的な表現"
  },
  {
    "word": "エッチ",
    "category": "sexual",
    "severity": 2,
    "language": "ja",
    "variations": ["えっち"],
    "description": "性的な表現"
  },
  {
    "word": "ヌード",
    "category": "sexual", 
    "severity": 2,
    "language": "ja",
    "variations": ["ぬーど"],
    "description": "性的な表現"
  },
  {
    "word": "ポルノ",
    "category": "sexual",
    "severity": 3,
    "language": "ja",
    "variations": ["ぽるの"],
    "description": "成人向けコンテンツ"
  },
  {
    "word": "詐欺",
    "category": "fraud",
    "severity": 3,
    "language": "ja",
    "variations": ["さぎ", "サギ"],
    "description": "詐欺行為を示す表現"
  },
  {
    "word": "騙す",
    "category": "fraud", 
    "severity": 3,
    "language": "ja",
    "variations": ["だます", "ダマス"],
    "description": "詐欺行為を示す表現"
  },
  {
    "word": "盗む",
    "category": "fraud",
    "severity": 3,
    "language": "ja",
    "variations": ["ぬすむ", "ヌスム"],
    "description": "窃盗行為を示す表現"
  },
  {
    "word": "犯罪",
    "category": "fraud",
    "severity": 3,
    "language": "ja",
    "variations": ["はんざい"],
    "description": "犯罪行為を示す表現"
  },
  {
    "word": "違法",
    "category": "fraud",
    "severity": 3, 
    "language": "ja",
    "variations": ["いほう", "イホウ"],
    "description": "違法行為を示す表現"
  },
  {
    "word": "薬物",
    "category": "fraud",
    "severity": 3,
    "language": "ja",
    "variations": ["やくぶつ"],
    "description": "薬物関連の表現"
  },
  {
    "word": "自殺",
    "category": "violence",
    "severity": 3,
    "language": "ja",
    "variations": ["じさつ", "ジサツ"],
    "description": "自殺に関する表現"
  },
  {
    "word": "死体",
    "category": "violence",
    "severity": 3,
    "language": "ja",
    "variations": ["したい", "シタイ"],
    "description": "死体に関する表現"
  }
]'::jsonb);

-- ========== Additional Common Japanese Internet Slang ==========

-- Add more modern internet slang and variations that might be problematic
INSERT INTO sensitive_words (word, category, severity, language, variations, description, source) VALUES
('荒らし', 'spam', 2, 'ja', '["あらし", "アラシ"]'::jsonb, 'ネット荒らし行為', 'additional_import'),
('煽り', 'hate', 2, 'ja', '["あおり", "アオリ"]'::jsonb, '煽り行為', 'additional_import'),
('炎上', 'spam', 1, 'ja', '["えんじょう", "エンジョウ"]'::jsonb, '炎上関連', 'additional_import'),
('晒し', 'hate', 3, 'ja', '["さらし", "サラシ"]'::jsonb, '個人情報晒し', 'additional_import'),
('キモい', 'hate', 1, 'ja', '["きもい"]'::jsonb, '軽度の侮辱', 'additional_import'),
('ウザい', 'hate', 1, 'ja', '["うざい", "うざ"]'::jsonb, '軽度の侮辱', 'additional_import'),
('死ぬ', 'violence', 2, 'ja', '["しぬ", "シヌ"]'::jsonb, '死に関する表現', 'additional_import'),
('殺害', 'violence', 3, 'ja', '["さつがい"]'::jsonb, '殺害に関する表現', 'additional_import'),
('攻撃', 'violence', 2, 'ja', '["こうげき"]'::jsonb, '攻撃的表現', 'additional_import'),
('破壊', 'violence', 2, 'ja', '["はかい"]'::jsonb, '破壊的表現', 'additional_import'),
('脅迫', 'violence', 3, 'ja', '["きょうはく"]'::jsonb, '脅迫行為', 'additional_import'),
('恐喝', 'fraud', 3, 'ja', '["きょうかつ"]'::jsonb, '恐喝行為', 'additional_import'),
('デマ', 'spam', 2, 'ja', '["でま"]'::jsonb, '虚偽情報', 'additional_import'),
('嘘', 'spam', 1, 'ja', '["うそ", "ウソ"]'::jsonb, '虚偽情報', 'additional_import'),
('捏造', 'spam', 3, 'ja', '["ねつぞう"]'::jsonb, '情報捏造', 'additional_import'),
('誹謗', 'hate', 3, 'ja', '["ひぼう"]'::jsonb, '誹謗中傷', 'additional_import'),
('中傷', 'hate', 3, 'ja', '["ちゅうしょう"]'::jsonb, '誹謗中傷', 'additional_import'),
('侮辱', 'hate', 2, 'ja', '["ぶじょく"]'::jsonb, '侮辱行為', 'additional_import'),
('罵倒', 'hate', 3, 'ja', '["ばとう"]'::jsonb, '罵倒行為', 'additional_import'),
('暴言', 'hate', 2, 'ja', '["ぼうげん"]'::jsonb, '暴言', 'additional_import'),
('悪口', 'hate', 1, 'ja', '["わるぐち"]'::jsonb, '悪口', 'additional_import'),
('いじめ', 'hate', 3, 'ja', '["イジメ", "苛め"]'::jsonb, 'いじめ行為', 'additional_import'),
('パワハラ', 'hate', 3, 'ja', '["ぱわはら"]'::jsonb, 'パワーハラスメント', 'additional_import'),
('セクハラ', 'sexual', 3, 'ja', '["せくはら"]'::jsonb, 'セクシャルハラスメント', 'additional_import'),
('ストーカー', 'hate', 3, 'ja', '["すとーかー"]'::jsonb, 'ストーカー行為', 'additional_import')
ON CONFLICT (word) DO NOTHING;

-- ========== Create indexes for imported data ==========

-- Refresh statistics after bulk import
ANALYZE sensitive_words;
ANALYZE sensitive_word_matches;

-- ========== Verification Query ==========

-- Verify the import was successful
DO $$
DECLARE
  word_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO word_count FROM sensitive_words WHERE language = 'ja';
  
  RAISE NOTICE 'Successfully imported % Japanese sensitive words', word_count;
  
  -- Log the categories breakdown
  FOR rec IN (
    SELECT category, COUNT(*) as count 
    FROM sensitive_words 
    WHERE language = 'ja' 
    GROUP BY category 
    ORDER BY count DESC
  )
  LOOP
    RAISE NOTICE 'Category %: % words', rec.category, rec.count;
  END LOOP;
END
$$;

-- ========== Comments ==========

COMMENT ON TABLE sensitive_words IS 'Contains Japanese sensitive words imported from the original hardcoded list plus additional internet slang terms';

-- ========== Create app_settings Table ==========

-- Create app_settings table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on app_settings
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read app settings
CREATE POLICY "Anyone can read app_settings" ON public.app_settings
  FOR SELECT USING (true);

-- Set up initial cache timestamp
-- This will be used by the client to determine if cache needs refresh
INSERT INTO public.app_settings (key, value, description) VALUES 
('sensitive_words_cache_version', extract(epoch from now())::text, 'Cache version for sensitive words - increment when words are updated')
ON CONFLICT (key) DO UPDATE SET 
  value = extract(epoch from now())::text,
  updated_at = now();