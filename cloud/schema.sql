-- D1 表结构：每条记录一行（按“家庭”分组）。本游戏目前每个家庭只用一行（kid = 'main'），保留多行结构是为了以后支持多个小朋友。
-- fam      家庭标识 = SHA-256("123-sync:" + 同步码)。数据库里不存同步码本身。
-- kid      记录 id
-- rev      版本号，每次成功写入 +1。客户端带着“我看到的版本”来写，不一致就返回 409（乐观锁），由客户端合并后重试
-- data     学习记录（JSON 文本）；prev 是“至少 6 小时前”的上一份快照，出问题时可以手动找回
-- deleted  1 = 墓碑
CREATE TABLE IF NOT EXISTS kids (
  fam     TEXT    NOT NULL,
  kid     TEXT    NOT NULL,
  rev     INTEGER NOT NULL,
  name    TEXT    NOT NULL DEFAULT '',
  data    TEXT    NOT NULL DEFAULT '',
  prev    TEXT    NOT NULL DEFAULT '',
  deleted INTEGER NOT NULL DEFAULT 0,
  updated INTEGER NOT NULL,
  PRIMARY KEY (fam, kid)
);
