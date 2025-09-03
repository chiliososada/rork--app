# Supabase 迁移文件执行顺序

## ❗ 重要说明

**不要执行** `20250902_auto_join_triggers_v2_DEPRECATED.sql` - 此文件会导致函数返回类型冲突错误。

## ✅ 正确的执行顺序

### 自动参加系统设置（按顺序执行）

1. **`20250902_cleanup_auto_join.sql`** 
   - 清理所有现有的自动参加函数和触发器
   - 解决函数返回类型冲突
   - ⚠️ 必须先执行此文件

2. **`20250902_auto_join_final.sql`**
   - 安装完整的自动参加系统
   - 包含改进的错误处理和日志
   - ✅ 主要的实施文件

3. **`verify_auto_join.sql`**
   - 验证系统是否正常工作
   - 运行自动测试
   - 📊 可选但推荐执行

## 📁 文件说明

### 有效文件
- ✅ `20250902_cleanup_auto_join.sql` - 清理脚本
- ✅ `20250902_auto_join_final.sql` - 最终实现
- ✅ `verify_auto_join.sql` - 验证脚本
- ✅ `AUTO_JOIN_SETUP_GUIDE.md` - 完整指南

### 已废弃的文件
- ❌ `20250902_auto_join_triggers_v2_DEPRECATED.sql` - 有问题的版本，不要使用
- ⚠️ `20250902_verify_auto_join_triggers.sql` - 旧版本，已被最终版本替代

## 🚀 快速开始

1. 打开 Supabase Dashboard → SQL Editor
2. 复制并执行 `20250902_cleanup_auto_join.sql` 的内容
3. 复制并执行 `20250902_auto_join_final.sql` 的内容
4. 复制并执行 `verify_auto_join.sql` 进行验证

## ❓ 故障排除

如果遇到任何问题，请参考：
- `AUTO_JOIN_SETUP_GUIDE.md` - 详细的故障排除指南
- Supabase Dashboard → Logs → Postgres Logs 查看错误日志

## 📱 应用程序重启

完成数据库迁移后：
```bash
npm start
```

---
**最后更新：2025-09-02**