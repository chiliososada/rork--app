
DECLARE
  calculated_age INTEGER;
  current_verification_status BOOLEAN;
  minimum_age_constant INTEGER := 18; -- Updated from 13 to 18
BEGIN
  -- Calculate age
  calculated_age := calculate_age(birth_date_param);
  
  -- Check current verification status
  SELECT age_verified INTO current_verification_status
  FROM users
  WHERE id = user_id_param;

  -- Log the verification attempt
  INSERT INTO age_verification_logs (
    user_id,
    birth_date_provided,
    calculated_age,
    verification_method,
    verification_successful,
    failure_reason,
    ip_address,
    user_agent
  ) VALUES (
    user_id_param,
    birth_date_param,
    calculated_age,
    verification_method_param,
    calculated_age >= minimum_age_constant,
    CASE 
      WHEN calculated_age < minimum_age_constant THEN '年齢制限に満たない（18歳未満）'
      WHEN calculated_age > 120 THEN '無効な生年月日'
      ELSE NULL
    END,
    ip_address_param,
    user_agent_param
  );

  -- Validate age
  IF calculated_age < minimum_age_constant THEN
    RETURN QUERY SELECT 
      FALSE, 
      calculated_age, 
      'このサービスは18歳以上の方のみご利用いただけます'::TEXT,
      FALSE;
    RETURN;
  END IF;

  IF calculated_age > 120 THEN
    RETURN QUERY SELECT 
      FALSE, 
      calculated_age, 
      '有効な生年月日を入力してください'::TEXT,
      FALSE;
    RETURN;
  END IF;

  -- Update user verification status
  UPDATE users
  SET 
    birth_date = birth_date_param,
    age_verified = TRUE,
    verification_method = verification_method_param,
    verification_date = NOW(),
    minimum_age_met = TRUE
  WHERE id = user_id_param;

  -- Return success (removed parent consent logic)
  RETURN QUERY SELECT 
    TRUE, 
    calculated_age,
    '年齢確認が完了しました'::TEXT,
    FALSE;
END;


BEGIN
  -- Update privacy settings
  UPDATE users
  SET 
    is_profile_public = is_profile_public_param,
    is_followers_visible = is_followers_visible_param
  WHERE id = user_id_param;
  
  IF FOUND THEN
    RETURN QUERY SELECT TRUE, 'プライバシー設定を更新しました'::TEXT;
  ELSE
    RETURN QUERY SELECT FALSE, 'ユーザーが見つかりません'::TEXT;
  END IF;
END;


BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;

  DECLARE
    existing_follow UUID;
  BEGIN
    -- 既存のフォロー関係をチェック
    SELECT id INTO existing_follow
    FROM user_follows
    WHERE follower_id = follower_id_param
      AND following_id = following_id_param;

    IF existing_follow IS NOT NULL THEN
      -- アンフォロー
      DELETE FROM user_follows WHERE id = existing_follow;
      RETURN QUERY SELECT 'unfollowed'::TEXT, false;
    ELSE
      -- フォロー
      INSERT INTO user_follows (follower_id, following_id)
      VALUES (follower_id_param, following_id_param);
      RETURN QUERY SELECT 'followed'::TEXT, true;
    END IF;
  END;
  
DECLARE
  is_self BOOLEAN;
  followers_visible BOOLEAN;
BEGIN
  -- Check if viewing own following list or if followers are visible
  is_self := (user_id_param = viewing_user_id);
  
  SELECT u.is_followers_visible INTO followers_visible
  FROM users u
  WHERE u.id = user_id_param;
  
  -- If not self and followers not visible, return empty
  IF NOT is_self AND NOT followers_visible THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT
    uf.following_id,
    u.nickname as following_name,
    u.avatar_url as following_avatar,
    uf.created_at as followed_at,
    (uf_back.id IS NOT NULL) as is_followed_back
  FROM user_follows uf
  JOIN users u ON u.id = uf.following_id
  LEFT JOIN user_follows uf_back
    ON uf_back.follower_id = uf.following_id AND uf_back.following_id = user_id_param
  WHERE uf.follower_id = user_id_param
  ORDER BY uf.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;



  BEGIN
    RETURN QUERY
    SELECT
      uf.following_id,
      u.nickname as following_name,
      u.avatar_url as following_avatar,
      uf.created_at as followed_at,
      (uf_back.id IS NOT NULL) as is_followed_back
    FROM user_follows uf
    JOIN users u ON u.id = uf.following_id
    LEFT JOIN user_follows uf_back
      ON uf_back.follower_id = uf.following_id AND uf_back.following_id = user_id_param
    WHERE uf.follower_id = user_id_param
    ORDER BY uf.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
  END;
  


  BEGIN
    RETURN QUERY
    SELECT
      t.id,
      t.title,
      t.description,
      t.user_id,
      t.latitude,
      t.longitude,
      t.location_name,
      t.created_at,
      t.image_url,
      t.image_aspect_ratio,
      t.original_width,
      t.original_height,
      u.nickname as user_name,
      u.avatar_url as user_avatar
    FROM topics t
    JOIN users u ON u.id = t.user_id
    WHERE t.user_id IN (
      SELECT following_id
      FROM user_follows
      WHERE follower_id = user_id_param
    )
    AND (t.is_hidden IS NULL OR t.is_hidden = false)
    ORDER BY t.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
  END;
  
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.description,
    t.user_id,
    t.latitude,
    t.longitude,
    t.location_name,
    t.created_at,
    t.image_url,
    t.image_aspect_ratio,
    -- 计算距离（单位：米）
    (6371000 * acos(
      cos(radians(user_lat)) * 
      cos(radians(t.latitude)) * 
      cos(radians(t.longitude) - radians(user_lng)) + 
      sin(radians(user_lat)) * 
      sin(radians(t.latitude))
    )) as distance_meters
  FROM topics t
  WHERE 
    -- 使用地理位置过滤（粗筛选提高性能）
    t.latitude BETWEEN user_lat - (radius_km / 111.0) AND user_lat + (radius_km / 111.0)
    AND t.longitude BETWEEN user_lng - (radius_km / (111.0 * cos(radians(user_lat)))) 
                          AND user_lng + (radius_km / (111.0 * cos(radians(user_lat))))
    -- 排除隐藏的内容
    AND (t.is_hidden IS NULL OR t.is_hidden = false)
  ORDER BY distance_meters ASC, t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;

  DECLARE
    chat_id UUID;
    smaller_id UUID;
    larger_id UUID;
  BEGIN
    -- 常に小さいIDを participant1_id にすることで重複を防ぐ
    IF user1_id < user2_id THEN
      smaller_id := user1_id;
      larger_id := user2_id;
    ELSE
      smaller_id := user2_id;
      larger_id := user1_id;
    END IF;

    -- 既存のチャットを検索
    SELECT id INTO chat_id
    FROM private_chats
    WHERE participant1_id = smaller_id AND participant2_id = larger_id;

    -- チャットが存在しない場合は作成
    IF chat_id IS NULL THEN
      INSERT INTO private_chats (participant1_id, participant2_id)
      VALUES (smaller_id, larger_id)
      RETURNING id INTO chat_id;
    END IF;

    RETURN chat_id;
  END;
  
  DECLARE
    chat_id UUID;
    smaller_id UUID;
    larger_id UUID;
  BEGIN
    -- 常に小さいIDを participant1_id にすることで重複を防ぐ
    IF user1_id < user2_id THEN
      smaller_id := user1_id;
      larger_id := user2_id;
    ELSE
      smaller_id := user2_id;
      larger_id := user1_id;
    END IF;

    -- 既存のチャットを検索
    SELECT id INTO chat_id
    FROM private_chats
    WHERE participant1_id = smaller_id AND participant2_id = larger_id;

    -- チャットが存在しない場合は作成
    IF chat_id IS NULL THEN
      INSERT INTO private_chats (participant1_id, participant2_id)
      VALUES (smaller_id, larger_id)
      RETURNING id INTO chat_id;
    END IF;

    RETURN chat_id;
  END;
  
BEGIN
  RETURN QUERY
  SELECT
    ucu.category_key,
    SUM(ucu.usage_count)::INTEGER as total_usage,
    COUNT(DISTINCT ucu.user_id)::INTEGER as unique_users,
    -- 人気度スコア：総使用回数 * ユニークユーザー数の平方根
    ROUND((SUM(ucu.usage_count) * SQRT(COUNT(DISTINCT ucu.user_id)))::DECIMAL, 2) as popularity_score
  FROM user_category_usage ucu
  GROUP BY ucu.category_key
  ORDER BY popularity_score DESC, total_usage DESC
  LIMIT limit_count;
END;

  BEGIN
    RETURN QUERY
    SELECT
      pc.id as chat_id,
      CASE
        WHEN pc.participant1_id = user_id_param THEN pc.participant2_id
        ELSE pc.participant1_id
      END as other_user_id,
      CASE
        WHEN pc.participant1_id = user_id_param THEN u2.nickname
        ELSE u1.nickname
      END as other_user_name,
      CASE
        WHEN pc.participant1_id = user_id_param THEN u2.avatar_url
        ELSE u1.avatar_url
      END as other_user_avatar,
      last_msg.message as last_message,
      pc.last_message_at,
      COALESCE(unread.unread_count, 0)::INTEGER as unread_count,
      COALESCE(last_msg.sender_id = user_id_param, FALSE) as is_sender
    FROM private_chats pc
    JOIN users u1 ON u1.id = pc.participant1_id
    JOIN users u2 ON u2.id = pc.participant2_id
    LEFT JOIN (
      SELECT DISTINCT ON (pm1.chat_id)
        pm1.chat_id, pm1.message, pm1.sender_id
      FROM private_messages pm1
      ORDER BY pm1.chat_id, pm1.created_at DESC
    ) last_msg ON last_msg.chat_id = pc.id
    LEFT JOIN (
      SELECT pm2.chat_id, COUNT(*)::INTEGER as unread_count
      FROM private_messages pm2
      WHERE pm2.sender_id != user_id_param AND pm2.is_read = FALSE
      GROUP BY pm2.chat_id
    ) unread ON unread.chat_id = pc.id
    WHERE pc.participant1_id = user_id_param OR pc.participant2_id = user_id_param
    ORDER BY pc.last_message_at DESC NULLS LAST, pc.created_at DESC
    LIMIT limit_count
    OFFSET offset_count;
  END;
                                                                                                                                                                                                                                                               
 BEGIN                                                                                                                                                                                                                                                             
   RETURN QUERY                                                                                                                                                                                                                                                    
   SELECT                                                                                                                                                                                                                                                          
     t.id,                                                                                                                                                                                                                                                         
     t.title,                                                                                                                                                                                                                                                      
     t.description,                                                                                                                                                                                                                                                
     t.user_id,                                                                                                                                                                                                                                                    
     t.latitude,                                                                                                                                                                                                                                                   
     t.longitude,                                                                                                                                                                                                                                                  
     t.location_name,                                                                                                                                                                                                                                              
     t.created_at,                                                                                                                                                                                                                                                 
     t.image_url,                                                                                                                                                                                                                                                  
     t.image_aspect_ratio,                                                                                                                                                                                                                                         
     COALESCE(t.tags, '[]'::jsonb) as tags,                                                                                                                                                                                                                        
     COALESCE(t.category, 'casual') as category,                                                                                                                                                                                                                   
     COALESCE(t.engagement_score, 0) as engagement_score,                                                                                                                                                                                                          
     COALESCE(t.is_promoted, false) as is_promoted,                                                                                                                                                                                                                
     COALESCE(tl.likes_count, 0)::INTEGER,                                                                                                                                                                                                                         
     COALESCE(tf.favorites_count, 0)::INTEGER,                                                                                                                                                                                                                     
     COALESCE(c.comments_count, 0)::INTEGER,                                                                                                                                                                                                                       
     (6371000 * acos(                                                                                                                                                                                                                                              
       cos(radians(user_lat)) *                                                                                                                                                                                                                                    
       cos(radians(t.latitude)) *                                                                                                                                                                                                                                  
       cos(radians(t.longitude) - radians(user_lng)) +                                                                                                                                                                                                             
       sin(radians(user_lat)) *                                                                                                                                                                                                                                    
       sin(radians(t.latitude))                                                                                                                                                                                                                                    
     )) as distance_meters,                                                                                                                                                                                                                                        
     CASE                                                                                                                                                                                                                                                          
       WHEN COALESCE(t.is_promoted, false) THEN 'プロモーション'                                                                                                                                                                                                   
       WHEN COALESCE(t.engagement_score, 0) > 0.8 THEN '人気急上昇'                                                                                                                                                                                                
       WHEN EXISTS (                                                                                                                                                                                                                                               
         SELECT 1 FROM user_follows uf                                                                                                                                                                                                                             
         WHERE uf.follower_id = user_id_param                                                                                                                                                                                                                      
         AND uf.following_id = t.user_id                                                                                                                                                                                                                           
       ) THEN 'フォロー中のユーザー'                                                                                                                                                                                                                               
       ELSE 'おすすめ'                                                                                                                                                                                                                                             
     END as recommendation_reason,                                                                                                                                                                                                                                 
     CASE                                                                                                                                                                                                                                                          
       WHEN COALESCE(t.is_promoted, false) THEN 'sponsored'                                                                                                                                                                                                        
       ELSE 'normal'                                                                                                                                                                                                                                               
     END as content_type                                                                                                                                                                                                                                           
   FROM topics t                                                                                                                                                                                                                                                   
   LEFT JOIN (                                                                                                                                                                                                                                                     
     SELECT topic_id, COUNT(*)::INTEGER as likes_count                                                                                                                                                                                                             
     FROM topic_likes GROUP BY topic_id                                                                                                                                                                                                                            
   ) tl ON t.id = tl.topic_id                                                                                                                                                                                                                                      
   LEFT JOIN (                                                                                                                                                                                                                                                     
     SELECT topic_id, COUNT(*)::INTEGER as favorites_count                                                                                                                                                                                                         
     FROM topic_favorites GROUP BY topic_id                                                                                                                                                                                                                        
   ) tf ON t.id = tf.topic_id                                                                                                                                                                                                                                      
   LEFT JOIN (                                                                                                                                                                                                                                                     
     SELECT topic_id, COUNT(*)::INTEGER as comments_count                                                                                                                                                                                                          
     FROM comments GROUP BY topic_id                                                                                                                                                                                                                               
   ) c ON t.id = c.topic_id                                                                                                                                                                                                                                        
   WHERE (t.is_hidden IS NULL OR t.is_hidden = false)                                                                                                                                                                                                              
   ORDER BY                                                                                                                                                                                                                                                        
     COALESCE(t.is_promoted, false) DESC,                                                                                                                                                                                                                          
     COALESCE(t.engagement_score, 0) DESC,                                                                                                                                                                                                                         
     distance_meters ASC,                                                                                                                                                                                                                                          
     t.created_at DESC                                                                                                                                                                                                                                             
   LIMIT limit_count                                                                                                                                                                                                                                               
   OFFSET offset_count;                                                                                                                                                                                                                                            
 END;                                                                                                                                                                                                                                                              
 
DECLARE
  start_date TIMESTAMP WITH TIME ZONE;
BEGIN
  start_date := NOW() - (days_back || ' days')::INTERVAL;
  
  RETURN QUERY
  SELECT
    COUNT(*)::INTEGER as total_reports,
    COUNT(CASE WHEN status = 'pending' THEN 1 END)::INTEGER as pending_reports,
    COUNT(CASE WHEN status = 'resolved' THEN 1 END)::INTEGER as resolved_reports,
    COUNT(CASE WHEN status = 'dismissed' THEN 1 END)::INTEGER as dismissed_reports,
    jsonb_object_agg(
      rc.display_name_ja,
      category_counts.count
    ) as category_breakdown
  FROM reports r
  JOIN report_categories rc ON rc.id = r.category_id
  JOIN (
    SELECT 
      category_id,
      COUNT(*) as count
    FROM reports
    WHERE created_at >= start_date
    GROUP BY category_id
  ) category_counts ON category_counts.category_id = r.category_id
  WHERE r.created_at >= start_date;
END;

BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    COALESCE(likes.count, 0)::INTEGER as likes_count,
    COALESCE(favorites.count, 0)::INTEGER as favorites_count,
    COALESCE(comments.count, 0)::INTEGER as comments_count
  FROM 
    unnest(topic_ids) AS t(id)
  LEFT JOIN (
    SELECT tl.topic_id, COUNT(*)::INTEGER as count
    FROM topic_likes tl
    WHERE tl.topic_id = ANY(topic_ids)
    GROUP BY tl.topic_id
  ) likes ON t.id = likes.topic_id
  LEFT JOIN (
    SELECT tf.topic_id, COUNT(*)::INTEGER as count
    FROM topic_favorites tf
    WHERE tf.topic_id = ANY(topic_ids)
    GROUP BY tf.topic_id
  ) favorites ON t.id = favorites.topic_id
  LEFT JOIN (
    SELECT c.topic_id, COUNT(*)::INTEGER as count
    FROM comments c
    WHERE c.topic_id = ANY(topic_ids)
    GROUP BY c.topic_id
  ) comments ON t.id = comments.topic_id;
END;

DECLARE
  topic_user_id UUID;
  location_visible BOOLEAN;
  location_precision TEXT;
  topic_lat DOUBLE PRECISION;
  topic_lng DOUBLE PRECISION;
  topic_location_name TEXT;
BEGIN
  -- トピックの情報を取得
  SELECT t.user_id, t.latitude, t.longitude, t.location_name
  INTO topic_user_id, topic_lat, topic_lng, topic_location_name
  FROM topics t
  WHERE t.id = topic_id_param;
  
  -- 自分のトピックの場合は常に正確な位置を返す
  IF topic_user_id = viewing_user_id THEN
    RETURN QUERY SELECT 
      topic_lat, 
      topic_lng, 
      topic_location_name,
      'exact'::TEXT,
      TRUE;
    RETURN;
  END IF;
  
  -- ユーザーの位置情報設定を取得
  SELECT u.is_location_visible, u.location_precision
  INTO location_visible, location_precision
  FROM users u
  WHERE u.id = topic_user_id;
  
  -- 位置情報非表示の場合
  IF NOT location_visible THEN
    RETURN QUERY SELECT 
      NULL::DOUBLE PRECISION, 
      NULL::DOUBLE PRECISION, 
      '位置情報非公開'::TEXT,
      'hidden'::TEXT,
      FALSE;
    RETURN;
  END IF;
  
  -- 精度設定に基づいて位置情報を返す
  CASE location_precision
    WHEN 'exact' THEN
      RETURN QUERY SELECT 
        topic_lat, 
        topic_lng, 
        topic_location_name,
        'exact'::TEXT,
        TRUE;
    WHEN 'area' THEN
      -- エリアレベル（約1km四方の精度）に曖昧化
      RETURN QUERY SELECT 
        ROUND(topic_lat::numeric, 2)::DOUBLE PRECISION,
        ROUND(topic_lng::numeric, 2)::DOUBLE PRECISION,
        COALESCE(
          (SELECT area_name FROM location_history 
           WHERE topic_id = topic_id_param LIMIT 1),
          '周辺エリア'
        ),
        'area'::TEXT,
        FALSE;
    WHEN 'city' THEN
      -- 市レベルの精度に曖昧化
      RETURN QUERY SELECT 
        ROUND(topic_lat::numeric, 1)::DOUBLE PRECISION,
        ROUND(topic_lng::numeric, 1)::DOUBLE PRECISION,
        COALESCE(
          (SELECT city_name FROM location_history 
           WHERE topic_id = topic_id_param LIMIT 1),
          '市内'
        ),
        'city'::TEXT,
        FALSE;
    ELSE -- 'hidden'
      RETURN QUERY SELECT 
        NULL::DOUBLE PRECISION, 
        NULL::DOUBLE PRECISION, 
        '位置情報非公開'::TEXT,
        'hidden'::TEXT,
        FALSE;
  END CASE;
END;
                                                                                                                                                                                                                                                             
 BEGIN                                                                                                                                                                                                                                                             
   -- 如果是"推荐"分类，调用推荐函数                                                                                                                                                                                                                               
   IF category_param = 'recommended' THEN                                                                                                                                                                                                                          
     RETURN QUERY                                                                                                                                                                                                                                                  
     SELECT                                                                                                                                                                                                                                                        
       t.id, t.title, t.description, t.user_id,                                                                                                                                                                                                                    
       t.latitude, t.longitude, t.location_name, t.created_at,                                                                                                                                                                                                     
       t.image_url, t.image_aspect_ratio, t.tags, t.category,                                                                                                                                                                                                      
       t.is_promoted, t.likes_count, t.distance_meters                                                                                                                                                                                                             
     FROM get_recommended_topics_v2(                                                                                                                                                                                                                               
       user_id_param, user_lat, user_lng, limit_count, offset_count                                                                                                                                                                                                
     ) t;                                                                                                                                                                                                                                                          
   ELSE                                                                                                                                                                                                                                                            
     -- 根据category字段筛选                                                                                                                                                                                                                                       
     RETURN QUERY                                                                                                                                                                                                                                                  
     SELECT                                                                                                                                                                                                                                                        
       t.id,                                                                                                                                                                                                                                                       
       t.title,                                                                                                                                                                                                                                                    
       t.description,                                                                                                                                                                                                                                              
       t.user_id,                                                                                                                                                                                                                                                  
       t.latitude,                                                                                                                                                                                                                                                 
       t.longitude,                                                                                                                                                                                                                                                
       t.location_name,                                                                                                                                                                                                                                            
       t.created_at,                                                                                                                                                                                                                                               
       t.image_url,                                                                                                                                                                                                                                                
       t.image_aspect_ratio,                                                                                                                                                                                                                                       
       COALESCE(t.tags, '[]'::jsonb) as tags,                                                                                                                                                                                                                      
       COALESCE(t.category, 'casual') as category,                                                                                                                                                                                                                 
       COALESCE(t.is_promoted, false) as is_promoted,                                                                                                                                                                                                              
       COALESCE(tl.likes_count, 0)::INTEGER,                                                                                                                                                                                                                       
       (6371000 * acos(                                                                                                                                                                                                                                            
         cos(radians(user_lat)) *                                                                                                                                                                                                                                  
         cos(radians(t.latitude)) *                                                                                                                                                                                                                                
         cos(radians(t.longitude) - radians(user_lng)) +                                                                                                                                                                                                           
         sin(radians(user_lat)) *                                                                                                                                                                                                                                  
         sin(radians(t.latitude))                                                                                                                                                                                                                                  
       )) as distance_meters                                                                                                                                                                                                                                       
     FROM topics t                                                                                                                                                                                                                                                 
     LEFT JOIN (                                                                                                                                                                                                                                                   
       SELECT topic_id, COUNT(*)::INTEGER as likes_count                                                                                                                                                                                                           
       FROM topic_likes GROUP BY topic_id                                                                                                                                                                                                                          
     ) tl ON t.id = tl.topic_id                                                                                                                                                                                                                                    
     WHERE                                                                                                                                                                                                                                                         
       COALESCE(t.category, 'casual') = category_param                                                                                                                                                                                                             
       AND (t.is_hidden IS NULL OR t.is_hidden = false)                                                                                                                                                                                                            
     ORDER BY                                                                                                                                                                                                                                                      
       COALESCE(t.is_promoted, false) DESC,                                                                                                                                                                                                                        
       distance_meters ASC,                                                                                                                                                                                                                                        
       t.created_at DESC                                                                                                                                                                                                                                           
     LIMIT limit_count                                                                                                                                                                                                                                             
     OFFSET offset_count;                                                                                                                                                                                                                                          
   END IF;                                                                                                                                                                                                                                                         
 END;                                                                                                                                                                                                                                                              
 
BEGIN
  RETURN QUERY
  SELECT 
    t.id as topic_id,
    loc.latitude,
    loc.longitude,
    loc.location_name,
    loc.precision_level,
    loc.is_exact
  FROM unnest(topic_ids) AS t(id)
  CROSS JOIN LATERAL get_topic_location_with_privacy(t.id, viewing_user_id) AS loc;
END;

BEGIN
  RETURN QUERY
  WITH user_topics AS (
    -- 获取用户创建的或参与的话题
    SELECT DISTINCT t.*,
           CASE WHEN t.user_id = user_id_param THEN TRUE ELSE FALSE END as is_creator,
           CASE WHEN tp.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_participant,
           tp.joined_at as participant_joined_at
    FROM topics t
    LEFT JOIN topic_participants tp 
      ON t.id = tp.topic_id 
      AND tp.user_id = user_id_param 
      AND tp.is_active = TRUE
    WHERE (t.user_id = user_id_param OR tp.user_id IS NOT NULL)
  ),
  topic_stats AS (
    -- 获取每个话题的统计信息
    SELECT 
      ut.id as topic_id,
      COUNT(DISTINCT c.id) as comment_count,
      COUNT(DISTINCT cm.user_id) + 1 as participant_count, -- +1 for topic creator
      MAX(cm.created_at) as last_message_time,
      (SELECT message FROM chat_messages WHERE topic_id = ut.id ORDER BY chat_messages.created_at DESC LIMIT 1) as last_message_preview
    FROM user_topics ut
    LEFT JOIN comments c ON ut.id = c.topic_id
    LEFT JOIN chat_messages cm ON ut.id = cm.topic_id
    GROUP BY ut.id
  )
  SELECT 
    ut.id,
    ut.title,
    ut.description,
    ut.user_id,
    ut.latitude,
    ut.longitude,
    ut.location_name,
    ut.created_at,
    ut.image_url,
    ut.image_aspect_ratio,
    ut.original_width,
    ut.original_height,
    u.nickname as user_nickname,
    u.avatar_url as user_avatar_url,
    u.email as user_email,
    COALESCE(ts.comment_count, 0) as comment_count,
    COALESCE(ts.participant_count, 1) as participant_count,
    ts.last_message_time,
    ts.last_message_preview,
    ut.is_creator,
    ut.is_participant,
    ut.participant_joined_at as joined_at
  FROM user_topics ut
  JOIN users u ON ut.user_id = u.id
  JOIN topic_stats ts ON ut.id = ts.topic_id
  ORDER BY 
    -- 参与的话题优先
    CASE WHEN ut.is_creator OR ut.is_participant THEN 0 ELSE 1 END,
    -- 有最新消息的优先
    ts.last_message_time DESC NULLS LAST,
    -- 最后按创建时间排序
    ut.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;

BEGIN
  RETURN QUERY
  SELECT
    u.id as user_id,
    CASE 
      WHEN u.id = viewing_user_id OR u.is_followers_visible THEN 
        COALESCE(followers.count, 0)::INTEGER
      ELSE NULL
    END as followers_count,
    CASE 
      WHEN u.id = viewing_user_id OR u.is_followers_visible THEN 
        COALESCE(following.count, 0)::INTEGER
      ELSE NULL
    END as following_count
  FROM
    unnest(user_ids) AS u_id(id)
  JOIN users u ON u.id = u_id.id
  LEFT JOIN (
    SELECT following_id, COUNT(*)::INTEGER as count
    FROM user_follows
    WHERE following_id = ANY(user_ids)
    GROUP BY following_id
  ) followers ON u.id = followers.following_id
  LEFT JOIN (
    SELECT follower_id, COUNT(*)::INTEGER as count
    FROM user_follows
    WHERE follower_id = ANY(user_ids)
    GROUP BY follower_id
  ) following ON u.id = following.follower_id;
END;

BEGIN
  RETURN QUERY
  SELECT 
    lh.id as history_id,
    lh.topic_id,
    t.title as topic_title,
    lh.latitude,
    lh.longitude,
    lh.location_name,
    lh.created_at as visited_at
  FROM location_history lh
  LEFT JOIN topics t ON t.id = lh.topic_id
  WHERE lh.user_id = user_id_param
  ORDER BY lh.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;

DECLARE
  profile_public BOOLEAN;
  followers_visible BOOLEAN;
  is_self BOOLEAN;
BEGIN
  -- Check if viewing own profile
  is_self := (requested_user_id = viewing_user_id);
  
  -- Get privacy settings
  SELECT u.is_profile_public, u.is_followers_visible 
  INTO profile_public, followers_visible
  FROM users u
  WHERE u.id = requested_user_id;
  
  RETURN QUERY
  SELECT
    u.id,
    u.nickname,
    u.avatar_url,
    CASE 
      WHEN is_self OR profile_public THEN u.email
      ELSE NULL
    END as email,
    CASE 
      WHEN is_self OR profile_public THEN u.gender
      ELSE NULL
    END as gender,
    u.created_at,
    CASE 
      WHEN is_self OR followers_visible THEN 
        (SELECT COUNT(*)::INTEGER FROM user_follows WHERE following_id = requested_user_id)
      ELSE NULL
    END as followers_count,
    CASE 
      WHEN is_self OR followers_visible THEN 
        (SELECT COUNT(*)::INTEGER FROM user_follows WHERE follower_id = requested_user_id)
      ELSE NULL
    END as following_count,
    u.is_profile_public,
    u.is_followers_visible,
    (is_self OR profile_public) as can_view_profile,
    (is_self OR followers_visible) as can_view_followers
  FROM users u
  WHERE u.id = requested_user_id;
END;

DECLARE
  new_report_id UUID;
  existing_report UUID;
  category_requires_details BOOLEAN;
BEGIN
  -- Check if user is trying to report themselves
  IF reporter_id_param = reported_user_id_param THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, '自分自身を通報することはできません'::TEXT;
    RETURN;
  END IF;

  -- Check if report already exists for this content
  IF content_id_param IS NOT NULL THEN
    SELECT id INTO existing_report
    FROM reports
    WHERE reporter_id = reporter_id_param
      AND content_type = content_type_param
      AND content_id = content_id_param
      AND status != 'dismissed';

    IF existing_report IS NOT NULL THEN
      RETURN QUERY SELECT existing_report, FALSE, '既にこのコンテンツを通報済みです'::TEXT;
      RETURN;
    END IF;
  END IF;

  -- Check if category requires details
  SELECT requires_details INTO category_requires_details
  FROM report_categories
  WHERE id = category_id_param;

  IF category_requires_details AND (description_param IS NULL OR description_param = '') THEN
    RETURN QUERY SELECT NULL::UUID, FALSE, 'この通報カテゴリには詳細な説明が必要です'::TEXT;
    RETURN;
  END IF;

  -- Insert the report
  INSERT INTO reports (
    reporter_id,
    reported_user_id,
    content_type,
    content_id,
    category_id,
    reason,
    description,
    priority
  ) VALUES (
    reporter_id_param,
    reported_user_id_param,
    content_type_param,
    content_id_param,
    category_id_param,
    reason_param,
    description_param,
    CASE 
      WHEN category_id_param IN (
        SELECT id FROM report_categories 
        WHERE category_key IN ('harassment', 'hate_speech', 'underage_user')
      ) THEN 4  -- High priority
      WHEN category_id_param IN (
        SELECT id FROM report_categories 
        WHERE category_key IN ('inappropriate_content', 'privacy_violation')
      ) THEN 3  -- Medium-high priority
      ELSE 2    -- Normal priority
    END
  ) RETURNING id INTO new_report_id;

  RETURN QUERY SELECT new_report_id, TRUE, '通報を受け付けました'::TEXT;
END;
