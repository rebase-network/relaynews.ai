# 技术运维手册

本文面向负责 `relaynew.ai` 线上环境的技术运维人员，聚焦以下主题：

- 部署
- 鉴权
- 备份与恢复
- 数据清理
- 故障排除

本文不覆盖后台业务操作细节；运营同学的后台使用方式请看
`docs/ADMIN_OPERATIONS.md`。

## 0. 高频速查

### 0.1 常用命令

先看服务状态：

```bash
./ops/manage.sh status
./ops/manage.sh health
./ops/manage.sh logs 200
```

发布远端 API：

```bash
./ops/manage.sh deploy
```

回滚远端 API：

```bash
./ops/manage.sh rollback
./ops/manage.sh rollback 20260415094500
```

发布 API Edge：

```bash
./ops/manage-api-edge.sh preview
./ops/manage-api-edge.sh deploy
```

进入远端主机：

```bash
./ops/manage.sh ssh
```

### 0.2 值班最小检查清单

每次发布后或值班接手时，至少确认：

- `./ops/manage.sh health` 正常
- `https://relaynew.ai` 可打开
- `https://a.relaynew.ai` 可打开
- `https://api.relaynew.ai/public/home-summary` 返回 JSON
- 如果后台开启鉴权，匿名访问 `/admin/overview` 返回 `401`
- `./ops/manage.sh status` 中 `api_build_ref` 与预期版本一致

### 0.3 关键路径

- SSH 主机：`rebase@rebase.host`
- 远端应用目录：`/home/rebase/apps/relaynews-api`
- 当前 release：`/home/rebase/apps/relaynews-api/current`
- 共享环境文件：`/home/rebase/apps/relaynews-api/shared/api.env`
- 备份目录建议：`/home/rebase/apps/relaynews-api/shared/backups`

## 1. 当前环境概览

### 1.1 线上入口

- 公共站点：`https://relaynew.ai`
- 管理后台：`https://a.relaynew.ai`
- 公共 API：`https://api.relaynew.ai`

### 1.2 远端主机

- SSH 入口：`rebase@rebase.host`
- 应用根目录：`/home/rebase/apps/relaynews-api`
- 当前发布目录软链接：`/home/rebase/apps/relaynews-api/current`
- 共享目录：`/home/rebase/apps/relaynews-api/shared`
- 后端环境文件：`/home/rebase/apps/relaynews-api/shared/api.env`
- 数据库备份目录建议：`/home/rebase/apps/relaynews-api/shared/backups`

### 1.3 运行形态

- `apps/api`：远端 Docker Compose 运行
- `apps/api-edge`：Cloudflare Worker，手工发布
- `apps/web`：Cloudflare Workers Builds 自动发布
- `apps/admin`：Cloudflare Workers Builds 自动发布
- PostgreSQL：远端 Docker Compose 内置 `postgres` 容器

### 1.4 常用脚本

- `./ops/manage.sh`：远端 API 运维主脚本
- `./ops/manage-api-edge.sh`：`api.relaynew.ai` 的 Worker 发布脚本
- `./ops/manage-tunnel.sh`：Cloudflare Tunnel 配置脚本
- `./ops/send-telegram.sh`：Telegram 通知脚本

## 2. 部署 Runbook

### 2.1 部署原则

- `relaynew.ai` 与 `a.relaynew.ai` 只能通过 GitHub 触发的 Cloudflare Workers Builds 发布
- `api.relaynew.ai` 通过 `./ops/manage-api-edge.sh deploy` 手工发布
- 远端 Node API 通过 `./ops/manage.sh deploy` 手工发布
- 不要用本地 `wrangler deploy` 或其他临时脚本去发布前台或后台

### 2.2 后端 API 部署

标准顺序：

1. 确认本地代码已提交
2. 确认远端 `api.env` 已更新
3. 执行 `./ops/manage.sh deploy`
4. 执行发布后检查
5. 如有异常，优先回滚

```bash
./ops/manage.sh bootstrap
```

上传远端环境文件：

```bash
./ops/manage.sh env-push /path/to/api.env
```

发布远端 API：

```bash
./ops/manage.sh deploy
```

部署后检查：

```bash
./ops/manage.sh status
./ops/manage.sh health
./ops/manage.sh logs 200
```

查看已发布版本：

```bash
./ops/manage.sh releases
```

回滚：

```bash
./ops/manage.sh rollback
./ops/manage.sh rollback 20260415094500
```

### 2.3 API Edge 发布

预检：

```bash
./ops/manage-api-edge.sh preview
```

正式发布：

```bash
./ops/manage-api-edge.sh deploy
```

### 2.4 前台与后台发布

- 提交代码并 push 到 Cloudflare Workers Builds 监听的分支
- 等待 Cloudflare 自动完成 `relaynew.ai` 与 `a.relaynew.ai` 发布
- 如需核对构建参数，见 `docs/CLOUDFLARE_WORKERS_BUILDS.md`

### 2.5 发布后最小检查清单

- `https://api.relaynew.ai/health` 正常
- `https://relaynew.ai` 可打开
- `https://a.relaynew.ai` 可打开
- 如开启了后台鉴权，后台先出现登录页，再进入 `/relays`
- 首页、榜单页、后台 Relay 列表至少能正常返回，不出现统一 5xx

### 2.6 紧急回滚

当发布后出现明显异常时，优先回滚远端 API：

```bash
./ops/manage.sh releases
./ops/manage.sh rollback
```

如需指定版本：

```bash
./ops/manage.sh rollback 20260415094500
```

回滚后重复执行：

```bash
./ops/manage.sh status
./ops/manage.sh health
./ops/manage.sh logs 200
```

## 3. 鉴权 Runbook

### 3.1 当前鉴权模型

当前后台没有多角色权限系统；现阶段的保护方式是：

- 后端对所有 `/admin/*` API 开启 Basic Auth
- 前端后台在访问控制台前先请求 `GET /admin/overview` 做 bootstrap 校验
- 如有需要，可以额外在 `a.relaynew.ai` 前加 Cloudflare Access

### 3.2 开启后台 Basic Auth

修改远端环境文件：

```env
ADMIN_AUTH_USERNAME=admin
ADMIN_AUTH_PASSWORD=replace-with-a-strong-password
```

上传并重启：

```bash
./ops/manage.sh env-push /path/to/api.env
./ops/manage.sh deploy
```

### 3.3 验证后台鉴权

匿名请求应返回 `401`：

```bash
curl -i https://api.relaynew.ai/admin/overview
```

带凭据请求应返回 `200`：

```bash
curl -i -u 'admin:replace-with-a-strong-password' \
  https://api.relaynew.ai/admin/overview
```

浏览器验证：

- 打开 `https://a.relaynew.ai`
- 应先看到登录页
- 登录成功后进入 `/relays`

### 3.4 鉴权注意事项

- `./ops/manage.sh health` 只检查 `/health`，不会证明后台鉴权配置正确
- 如果加了 Cloudflare Access，仍建议保留 API Basic Auth 作为第二层保护
- 本地开发可留空 `ADMIN_AUTH_USERNAME` 和 `ADMIN_AUTH_PASSWORD`，生产环境不建议留空

## 4. 备份与恢复 Runbook

### 4.1 备份原则

- 任何生产数据清理、批量修复、恢复操作前，先做数据库备份
- 备份文件统一放在共享目录下，避免随着 release 目录切换丢失
- 推荐命名格式：`relaynews-<action>-YYYYMMDDHHMMSS.sql.gz`

### 4.2 创建数据库备份

推荐在本地执行：

```bash
ssh rebase@rebase.host 'bash -s' <<'EOF'
set -euo pipefail
export API_ENV_FILE=/home/rebase/apps/relaynews-api/shared/api.env
export API_HOST_PORT=8787
export COMPOSE_PROJECT_NAME=relaynews-api
COMPOSE_FILE=ops/docker-compose.api.yml
BASE=/home/rebase/apps/relaynews-api/current
BACKUP_DIR=/home/rebase/apps/relaynews-api/shared/backups

set -a
. "$API_ENV_FILE"
set +a

mkdir -p "$BACKUP_DIR"
cd "$BASE"

backup_file="$BACKUP_DIR/relaynews-manual-$(date +%Y%m%d%H%M%S).sql.gz"
docker compose -f "$COMPOSE_FILE" exec -T postgres \
  pg_dump -U "${POSTGRES_USER:-relaynews}" -d "${POSTGRES_DB:-relaynews}" \
  | gzip > "$backup_file"

echo "$backup_file"
EOF
```

备份完成后应记录：

- 备份文件完整路径
- 备份时间
- 触发原因，例如“发布前备份”或“清理前备份”

### 4.3 恢复数据库

恢复前建议先确认：

- 当前是否处于维护窗口
- 是否已经拿到最近备份
- 是否需要先通知运营暂停操作后台

推荐恢复流程：

1. 登录远端主机
2. 停掉 `api` 与 `cloudflared`
3. 将备份内容写回 PostgreSQL
4. 启动服务
5. 刷新公开快照
6. 做健康检查

示例：

```bash
ssh rebase@rebase.host

export API_ENV_FILE=/home/rebase/apps/relaynews-api/shared/api.env
export API_HOST_PORT=8787
export COMPOSE_PROJECT_NAME=relaynews-api
cd /home/rebase/apps/relaynews-api/current

set -a
. "$API_ENV_FILE"
set +a

docker compose -f ops/docker-compose.api.yml stop api cloudflared

gunzip -c /home/rebase/apps/relaynews-api/shared/backups/relaynews-manual-YYYYMMDDHHMMSS.sql.gz \
  | docker compose -f ops/docker-compose.api.yml exec -T postgres \
      psql -U "${POSTGRES_USER:-relaynews}" -d "${POSTGRES_DB:-relaynews}"

docker compose -f ops/docker-compose.api.yml up -d api cloudflared
docker compose -f ops/docker-compose.api.yml exec -T api \
  tsx apps/api/src/scripts/refresh-public.ts

curl --fail --silent --show-error http://127.0.0.1:${API_HOST_PORT}/health
```

恢复后至少检查：

- `/health`
- `/public/home-summary`
- `https://relaynew.ai`
- `https://a.relaynew.ai`

### 4.4 恢复后的追加动作

恢复完成后建议再执行一次：

```bash
docker compose -f ops/docker-compose.api.yml exec -T api \
  tsx apps/api/src/scripts/refresh-public.ts
```

避免首页与榜单仍引用旧快照或缺少快照。

## 5. 数据清理 Runbook

### 5.1 适用场景

仅在以下场景使用：

- 上线前清理测试数据
- 需要将环境恢复到“待运营初始化”的空白状态
- 经过确认要重置业务表数据

不要把数据清理当成常规运维动作。

### 5.2 清理原则

- 先备份，再清理
- 清理后立即刷新公开快照
- 清理后要通知运营重新录入模型、Relay、价格表和测试 Key

标准顺序：

1. 先做数据库备份
2. 再执行 `TRUNCATE`
3. 立即刷新公开快照
4. 验证空快照是否生成
5. 通知运营开始初始化录入

### 5.3 清理当前业务数据

以下命令会清空当前业务表，并保留结构：

```bash
ssh rebase@rebase.host 'bash -s' <<'EOF'
set -euo pipefail
export API_ENV_FILE=/home/rebase/apps/relaynews-api/shared/api.env
export API_HOST_PORT=8787
export COMPOSE_PROJECT_NAME=relaynews-api
COMPOSE_FILE=ops/docker-compose.api.yml
BASE=/home/rebase/apps/relaynews-api/current

set -a
. "$API_ENV_FILE"
set +a
cd "$BASE"

docker compose -f "$COMPOSE_FILE" exec -T postgres \
  psql -v ON_ERROR_STOP=1 -U "${POSTGRES_USER:-relaynews}" -d "${POSTGRES_DB:-relaynews}" <<'SQL'
TRUNCATE TABLE
  home_summary_snapshots,
  relay_overview_snapshots,
  leaderboard_snapshots,
  relay_score_hourly,
  relay_latency_5m,
  relay_status_5m,
  incident_events,
  probe_error_samples,
  probe_results_raw,
  sponsors,
  probe_credentials,
  submission_model_prices,
  submissions,
  relay_prices,
  relay_models,
  models,
  relays
RESTART IDENTITY CASCADE;
SQL

docker compose -f "$COMPOSE_FILE" exec -T api \
  tsx apps/api/src/scripts/refresh-public.ts
EOF
```

### 5.4 清理后的预期状态

- `relays = 0`
- `models = 0`
- `submissions = 0`
- `leaderboard_snapshots = 0`
- `relay_overview_snapshots = 0`
- `home_summary_snapshots = 1`

此时：

- 首页应显示空站点数据
- 榜单目录应为空
- 后台需由运营重新录入基础数据

### 5.5 清理后运营初始化顺序

建议运营按这个顺序手工填写：

1. 先创建模型
2. 再创建 Relay
3. 填写价格表
4. 配置测试 Key
5. 将需要公开展示的 Relay 置为 `active`

## 6. 故障排除 Runbook

### 6.1 故障定位矩阵

| 现象 | 第一检查点 | 常见处理 |
|---|---|---|
| `/health` 失败 | `./ops/manage.sh status` | 看容器状态与日志，必要时重启或回滚 |
| 后台显示无法连接管理 API | `curl -i https://api.relaynew.ai/admin/overview` | 先分辨是 `401`、`5xx` 还是浏览器侧失败 |
| 首页 / 榜单返回 500 | `/public/home-summary` 是否有快照 | 执行公开快照刷新 |
| 发布后仍像旧版本 | `./ops/manage.sh status` 的 `api_build_ref` | 重新 deploy 或 rollback |
| API Edge 不通 | 远端 API 是否健康、`cloudflared` 是否正常 | 查日志，必要时重新发布 API Edge |
| 清理后前台没内容 | `relays` / `models` 是否为空 | 这通常是预期结果，通知运营补录 |

### 6.2 常用检查命令

```bash
./ops/manage.sh status
./ops/manage.sh health
./ops/manage.sh logs 200
./ops/manage.sh releases
```

远端进入 shell：

```bash
./ops/manage.sh ssh
```

远端执行一次性命令：

```bash
./ops/manage.sh remote 'uname -a'
```

### 6.3 API 健康正常，但后台无法登录

排查顺序：

1. 检查远端 `api.env` 是否同时设置了：
   - `ADMIN_AUTH_USERNAME`
   - `ADMIN_AUTH_PASSWORD`
2. 检查匿名访问是否返回 `401`：

   ```bash
   curl -i https://api.relaynew.ai/admin/overview
   ```

3. 检查带凭据访问是否返回 `200`：

   ```bash
   curl -i -u 'admin:password' https://api.relaynew.ai/admin/overview
   ```

4. 浏览器 DevTools 查看 `/admin/overview`：
   - `401`：前端应进入登录页
   - `5xx`：看 API 日志
   - `blocked` / `failed`：看本地网络、浏览器插件或代理

### 6.4 首页或榜单接口返回 500

常见原因：

- 公开快照不存在
- 数据刚被清理，但没有执行公开快照刷新

修复：

```bash
ssh rebase@rebase.host
export API_ENV_FILE=/home/rebase/apps/relaynews-api/shared/api.env
export API_HOST_PORT=8787
export COMPOSE_PROJECT_NAME=relaynews-api
cd /home/rebase/apps/relaynews-api/current

set -a
. "$API_ENV_FILE"
set +a

docker compose -f ops/docker-compose.api.yml exec -T api \
  tsx apps/api/src/scripts/refresh-public.ts
```

然后检查：

```bash
curl -s https://api.relaynew.ai/public/home-summary
curl -s https://api.relaynew.ai/public/leaderboard-directory
```

### 6.5 发布后怀疑仍是旧版本

检查：

```bash
./ops/manage.sh status
```

重点看：

- `current_release`
- `api_build_ref`

如果版本不对：

- 重新执行 `./ops/manage.sh deploy`
- 如需恢复旧版本，用 `./ops/manage.sh rollback`

### 6.6 API Edge 无法访问

检查顺序：

1. 远端 API 是否健康
2. `cloudflared` 是否在运行
3. `relaynews-api-edge` 是否已成功发布

可先看远端容器状态：

```bash
./ops/manage.sh status
./ops/manage.sh logs 200
```

然后视情况重新发布 API Edge：

```bash
./ops/manage-api-edge.sh deploy
```

### 6.7 清理后前台没有数据

这通常不是故障，而是预期结果。

如果已经执行过数据清理：

- 首页可能只显示空统计
- 榜单目录为空
- Relay 详情页不会有任何公开条目

这时应先让运营补录模型和 Relay，而不是继续查代码。

## 7. 值班交接清单

交接时建议至少同步以下信息：

- 远端主机登录方式
- `api.env` 的保管位置
- 最新可用数据库备份路径
- 当前发布版本号
- Cloudflare 账号与 Workers Builds 入口
- Telegram 通知脚本使用方式

如果后续运维动作增多，可继续在本文补充：

- 周期性备份策略
- 告警与监控接入方式
- 更细的值班检查清单
