# yunzai-plugin-manager

单文件、跨平台的一键插件拉取与依赖安装工具。通过交互选择预置仓库，按所选顺序在当前目录克隆至指定子路径，全部完成后在当前目录执行一次 `pnpm i`。脚本本身不产生除克隆目标与依赖安装外的任何额外文件。

## 特色

- 纯单文件：`clone-and-install.js`，无需任何额外配置文件。
- 跨平台：支持 Linux 与 Windows（Node.js 运行）。
- 交互选择：输入 `1` 单选，或输入 `1|3|2` 多选（按输入顺序依次克隆）。
- 安全稳健：已存在的 Git 目录执行 `git pull --ff-only`；非空且非 Git 目录跳过，避免破坏现有文件。
- 依赖自检：启动前检查 `git` 与 `pnpm` 是否可用并提示安装方式。

## 依赖要求

- Node.js：版本 >= 16。
- Git：可执行 `git --version`。
- pnpm：可执行 `pnpm --version`（缺失时可通过 `npm i -g pnpm` 安装）。

## 快速开始

1) 克隆或进入你的项目目录（脚本会在当前目录内工作）。

2) 运行脚本：

- Linux/macOS：

```bash
node ./clone-and-install.js
# 如需通过脚本文件直接执行：
chmod +x ./clone-and-install.js && ./clone-and-install.js
```

- Windows（PowerShell/CMD）：

```powershell
node .\clone-and-install.js
```

3) 根据提示输入编号并确认，等待所有仓库拉取完成后，脚本会在当前目录执行一次 `pnpm i`。

### 一键下载并执行

从脚本仓库直接拉取并运行（默认分支自动跟随，使用 `HEAD` 引用）：

- Linux/macOS（curl）：

```bash
curl -fsSL https://raw.githubusercontent.com/maqibg/yunzai-plugin-manager/HEAD/clone-and-install.js -o clone-and-install.js \
  && node ./clone-and-install.js
```

- Linux/macOS（wget）：

```bash
wget -qO clone-and-install.js https://raw.githubusercontent.com/maqibg/yunzai-plugin-manager/HEAD/clone-and-install.js \
  && node ./clone-and-install.js
```

- Windows PowerShell：

```powershell
iwr -useb https://raw.githubusercontent.com/maqibg/yunzai-plugin-manager/HEAD/clone-and-install.js -OutFile clone-and-install.js; node .\clone-and-install.js
```

希望执行后自动清理脚本文件，可使用以下命令：

- Linux/macOS（curl，执行后删除本地脚本）：

```bash
curl -fsSL https://raw.githubusercontent.com/maqibg/yunzai-plugin-manager/HEAD/clone-and-install.js -o ci.js \
  && node ./ci.js && rm -f ./ci.js
```

- Windows PowerShell（执行后删除本地脚本）：

```powershell
iwr -useb https://raw.githubusercontent.com/maqibg/yunzai-plugin-manager/HEAD/clone-and-install.js -OutFile ci.js; node .\ci.js; del .\ci.js
```

## 交互说明

- 列表示例：

```
[1] earth-k-plugin -> plugins/earth-k-plugin (https://github.com/maqibg/earth-k-plugin.git)
[2] trss-xianxin-plugin -> plugins/trss-xianxin-plugin (https://github.com/maqibg/trss-xianxin-plugin.git)
...
```

- 选择规则：
  - 单选：输入 `1`。
  - 多选：输入 `1|3|2`（使用竖线分隔）。
  - 去重：重复编号会被去重，但保留首次出现的顺序。
  - 越界或非法编号会被忽略，若所有输入无效将要求重新输入。



说明：部分仓库使用浅克隆 `--depth=1`，少量仓库指定分支（如 `-b build` 或 `--branch main3`）。

## 行为细节

- 克隆顺序：严格按你的输入顺序依次处理。
- 目标不存在：执行 `git clone [--branch X] [--depth N] <url> <target>`。
- 目标存在且为 Git 仓库：执行 `git -C <target> pull --ff-only`。
- 目标存在且为非空非 Git 目录：跳过该项，并在汇总中标记为跳过。
- 全部处理完成：在脚本运行目录执行一次 `pnpm i`。
- 退出码：若存在拉取失败项，脚本以非零退出码结束；否则为 0。

## 常见问题（FAQ）

- 缺少 git 或 pnpm：脚本会给出明确提示并退出。安装后重试。
- 网络异常或超时：检查代理与网络环境；可设置 `HTTP_PROXY/HTTPS_PROXY` 供 `git` 与 `pnpm` 使用。
- 目录已存在但不是 Git 仓库：脚本会跳过该项，避免破坏现有内容。若需覆盖，请手动备份并清理后重试。
- Windows 下路径或权限问题：建议在开发者 PowerShell 或 CMD 以普通或管理员权限运行；确保杀毒/安全软件未阻截 `git`。

## 自定义与扩展

本工具为单文件实现，配置位于脚本顶部 `REPOS` 数组（在 `clone-and-install.js` 内）。你可以：

- 添加/删除仓库：增删 `REPOS` 数组项（包含 `name/url/target`，可选 `depth/branch`）。
- 自定义目标路径：`target` 为相对路径，相对于脚本运行目录。
- 调整浅克隆深度与分支：分别通过 `depth` 与 `branch` 字段控制。

修改完成后，直接再次运行脚本即可，无需任何额外文件。

## 故障排查

- 查看原始错误输出：脚本透传 `git` 与 `pnpm` 的标准输出/错误，便于直接定位问题。
- 逐项排查：可先只选择一个仓库测试；成功后逐步扩大选择范围。
- 清理与重试：若目录处于异常状态，可手动备份并删除目标目录后重试克隆。

## 安全提示

- 脚本仅在当前目录内执行克隆操作与一次 `pnpm i`，不写入除目标目录与依赖外的任何其他文件。
- 请仅添加信任来源的仓库地址；对未知脚本与依赖保持警惕。
