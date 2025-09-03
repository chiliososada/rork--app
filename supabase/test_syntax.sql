-- 構文テスト用のシンプルな関数
-- この関数が正常に作成できれば、構文エラーが修正されています

CREATE OR REPLACE FUNCTION test_syntax_fix()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE NOTICE 'テスト関数が正常に作成されました';
    RETURN jsonb_build_object('success', true, 'message', '構文修正完了');
EXCEPTION
    WHEN OTHERS THEN
        -- 修正された構文を使用
        RAISE EXCEPTION '構文テスト中にエラー: %', SQLERRM;
END;
$$;

-- テスト関数を実行
SELECT test_syntax_fix();

-- テスト関数を削除
DROP FUNCTION test_syntax_fix();