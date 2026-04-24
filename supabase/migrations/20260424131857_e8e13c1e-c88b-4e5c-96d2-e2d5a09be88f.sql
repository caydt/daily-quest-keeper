
-- updated_at 자동 갱신 함수
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- garden_state: 사용자당 1행, 전체 앱 상태를 JSONB로 저장
CREATE TABLE public.garden_state (
  user_id UUID NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  state JSONB NOT NULL DEFAULT '{}'::jsonb,
  version BIGINT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.garden_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own garden"
  ON public.garden_state FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own garden"
  ON public.garden_state FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own garden"
  ON public.garden_state FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own garden"
  ON public.garden_state FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE TRIGGER garden_state_set_updated_at
  BEFORE UPDATE ON public.garden_state
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 가입 시 빈 행 자동 생성
CREATE OR REPLACE FUNCTION public.handle_new_user_garden()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.garden_state (user_id, state)
  VALUES (NEW.id, '{}'::jsonb)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created_garden
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_garden();

-- 실시간 구독 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE public.garden_state;
