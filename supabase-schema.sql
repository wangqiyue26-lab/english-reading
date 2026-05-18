-- Supabase Schema for English Reading App
-- Run this in Supabase SQL Editor: https://app.supabase.com → Your Project → SQL Editor

-- ============================================
-- Profiles table (extends auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'username');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- User Vocab
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_vocab (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  word TEXT NOT NULL,
  phonetic TEXT DEFAULT '',
  definition TEXT DEFAULT '',
  added_at TIMESTAMPTZ DEFAULT now(),
  reviews JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'new'
);

CREATE INDEX IF NOT EXISTS idx_user_vocab_user ON public.user_vocab(user_id);

ALTER TABLE public.user_vocab ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own vocab"
  ON public.user_vocab FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Bookmarks
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_bookmarks (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_user_bookmarks_user ON public.user_bookmarks(user_id);

ALTER TABLE public.user_bookmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own bookmarks"
  ON public.user_bookmarks FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Reads
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_reads (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  read_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_user_reads_user ON public.user_reads(user_id);

ALTER TABLE public.user_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reads"
  ON public.user_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Daily Stats
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_daily_stats (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  articles INT DEFAULT 0,
  words INT DEFAULT 0,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_stats_user ON public.user_daily_stats(user_id);

ALTER TABLE public.user_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily stats"
  ON public.user_daily_stats FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Streak Dates
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_streak_dates (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_streak_dates_user ON public.user_streak_dates(user_id);

ALTER TABLE public.user_streak_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own streak dates"
  ON public.user_streak_dates FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Last Read
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_last_read (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  progress INT DEFAULT 0,
  "timestamp" BIGINT DEFAULT 0
);

ALTER TABLE public.user_last_read ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own last read"
  ON public.user_last_read FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Reading Speeds
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_reading_speeds (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  records JSONB DEFAULT '[]'::jsonb,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_reading_speeds_user ON public.user_reading_speeds(user_id);

ALTER TABLE public.user_reading_speeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own reading speeds"
  ON public.user_reading_speeds FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Focus Sessions
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_focus_sessions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date TIMESTAMPTZ DEFAULT now(),
  duration INT NOT NULL,
  article_id TEXT,
  partial BOOLEAN DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_user_focus_sessions_user ON public.user_focus_sessions(user_id);

ALTER TABLE public.user_focus_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own focus sessions"
  ON public.user_focus_sessions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Notes (highlights & annotations, article-keyed)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_notes (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  article_id TEXT NOT NULL,
  notes JSONB DEFAULT '[]'::jsonb,
  UNIQUE(user_id, article_id)
);

CREATE INDEX IF NOT EXISTS idx_user_notes_user ON public.user_notes(user_id);

ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own notes"
  ON public.user_notes FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Settings
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_settings (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  settings JSONB DEFAULT '{}'::jsonb
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own settings"
  ON public.user_settings FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================
-- User Daily Pick
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_daily_pick (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  article_id TEXT NOT NULL,
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_daily_pick_user ON public.user_daily_pick(user_id);

ALTER TABLE public.user_daily_pick ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own daily pick"
  ON public.user_daily_pick FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
