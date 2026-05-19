import {
	App,
	ButtonComponent,
	DropdownComponent,
	FileSystemAdapter,
	getLanguage,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
	TextComponent,
	ToggleComponent
} from "obsidian";
import { execFile } from "child_process";
import { existsSync } from "fs";
import * as fs from "fs/promises";
import * as os from "os";
import * as path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const CONFIG_FOLDER_NAME = ".obsidian";
const THEME_APPEARANCE_KEYS = [
	"cssTheme",
	"baseTheme",
	"theme",
	"accentColor",
	"translucency",
	"nativeMenus",
	"showRibbon",
	"showViewHeader"
];
const FONT_APPEARANCE_KEYS = [
	"baseFontSize",
	"baseFontSizeAction",
	"interfaceFontFamily",
	"textFontFamily",
	"monospaceFontFamily"
];

type Locale = "zh-CN" | "en";
type CopyCategory =
	| "theme"
	| "fonts"
	| "cssSnippets"
	| "hotkeys"
	| "communityPlugins"
	| "corePlugins"
	| "editorAndFileSettings"
	| "graphSettings"
	| "notesAndTemplates"
	| "workspaceLayout"
	| "otherConfig";
type CopyChoice = "lookAndFonts" | "cssSnippets" | "editingHabits" | "dailyAndGraph" | "plugins";

interface VaultThemeCreatorSettings {
	uiLanguage: "auto" | Locale;
}

interface ThemeSourceOption {
	vaultPath: string;
	vaultName: string;
	themeName: string;
	isCurrentVault: boolean;
}

interface CreateVaultFormResult {
	sourceOption: ThemeSourceOption;
	vaultName: string;
	parentDirectory: string;
	copyCategories: CopyCategory[];
}

type TranslationKey =
	| "pluginName"
	| "commandCreate"
	| "ribbonCreate"
	| "settingsTitle"
	| "settingsLanguage"
	| "settingsLanguageDesc"
	| "languageAuto"
	| "languageChinese"
	| "languageEnglish"
	| "settingsFlow"
	| "settingsFlowDesc"
	| "themePickerPlaceholder"
	| "themePickerCurrentVault"
	| "themePickerFromVault"
	| "themeDefault"
	| "themeUnknown"
	| "themeNamePrefix"
	| "themeSourceChoose"
	| "createTitle"
	| "createSourceTheme"
	| "createSourceSection"
	| "createSourceSectionDesc"
	| "createSourceDropdown"
	| "createSourceDropdownDesc"
	| "createSourcePath"
	| "createCopySection"
	| "createTargetSection"
	| "createTargetSectionDesc"
	| "createCopyOptions"
	| "createCopyOptionsDesc"
	| "copyChoiceLookAndFonts"
	| "copyChoiceLookAndFontsDesc"
	| "copyChoiceEditingHabits"
	| "copyChoiceEditingHabitsDesc"
	| "copyChoiceDailyAndGraph"
	| "copyChoiceDailyAndGraphDesc"
	| "copyChoicePlugins"
	| "copyChoicePluginsDesc"
	| "copyCategoryTheme"
	| "copyCategoryThemeDesc"
	| "copyCategoryFonts"
	| "copyCategoryFontsDesc"
	| "copyCategoryCssSnippets"
	| "copyCategoryCssSnippetsDesc"
	| "copyCategoryHotkeys"
	| "copyCategoryHotkeysDesc"
	| "copyCategoryCommunityPlugins"
	| "copyCategoryCommunityPluginsDesc"
	| "copyCategoryCorePlugins"
	| "copyCategoryCorePluginsDesc"
	| "copyCategoryEditorAndFileSettings"
	| "copyCategoryEditorAndFileSettingsDesc"
	| "copyCategoryGraphSettings"
	| "copyCategoryGraphSettingsDesc"
	| "copyCategoryNotesAndTemplates"
	| "copyCategoryNotesAndTemplatesDesc"
	| "copyCategoryWorkspaceLayout"
	| "copyCategoryWorkspaceLayoutDesc"
	| "copyCategoryOtherConfig"
	| "copyCategoryOtherConfigDesc"
	| "copyGroupAppearance"
	| "copyGroupAppearanceDesc"
	| "copyGroupBehavior"
	| "copyGroupBehaviorDesc"
	| "copyGroupPlugins"
	| "copyGroupPluginsDesc"
	| "createVaultName"
	| "createVaultNameDesc"
	| "createVaultNamePlaceholder"
	| "createLocation"
	| "createLocationDesc"
	| "createLocationPlaceholder"
	| "createBrowse"
	| "createButton"
	| "cancelButton"
	| "noticeCreated"
	| "noticeLanguageChanged"
	| "noticeNoVaults"
	| "errorDesktopOnly"
	| "errorVaultNameRequired"
	| "errorVaultNameInvalid"
	| "errorParentDirectoryRequired"
	| "errorParentDirectoryMissing"
	| "errorVaultExists"
	| "errorSourceMissingConfig"
	| "errorBrowseUnavailable"
	| "errorNoCopyCategories";

const DEFAULT_SETTINGS: VaultThemeCreatorSettings = {
	uiLanguage: "auto"
};

const APP_JSON = "app.json";
const APPEARANCE_JSON = "appearance.json";
const COMMUNITY_CSS_SNIPPETS_JSON = "community-css-snippets.json";
const COMMUNITY_PLUGINS_JSON = "community-plugins.json";
const CORE_PLUGINS_JSON = "core-plugins.json";
const GRAPH_JSON = "graph.json";
const HOTKEYS_JSON = "hotkeys.json";
const WORKSPACE_JSON = "workspace.json";
const WORKSPACE_MOBILE_JSON = "workspace-mobile.json";
const PLUGINS_DIR = "plugins";
const SNIPPETS_DIR = "snippets";
const THEMES_DIR = "themes";
const DAILY_NOTES_JSON = "daily-notes.json";
const TEMPLATES_JSON = "templates.json";
const UNIQUE_NOTE_CREATOR_JSON = "unique-note-creator.json";

interface CopyCategoryOption {
	id: CopyChoice;
	labelKey: TranslationKey;
	descKey: TranslationKey;
	defaultSelected: boolean;
	categories: CopyCategory[];
}

interface CopyCategoryGroup {
	labelKey: TranslationKey;
	descKey: TranslationKey;
	options: CopyCategoryOption[];
}

const COPY_CATEGORY_GROUPS: CopyCategoryGroup[] = [
	{
		labelKey: "copyGroupAppearance",
		descKey: "copyGroupAppearanceDesc",
		options: [
			{
				id: "lookAndFonts",
				labelKey: "copyChoiceLookAndFonts",
				descKey: "copyChoiceLookAndFontsDesc",
				defaultSelected: true,
				categories: ["theme", "fonts"]
			},
			{
				id: "cssSnippets",
				labelKey: "copyCategoryCssSnippets",
				descKey: "copyCategoryCssSnippetsDesc",
				defaultSelected: true,
				categories: ["cssSnippets"]
			}
		]
	},
	{
		labelKey: "copyGroupBehavior",
		descKey: "copyGroupBehaviorDesc",
		options: [
			{
				id: "editingHabits",
				labelKey: "copyChoiceEditingHabits",
				descKey: "copyChoiceEditingHabitsDesc",
				defaultSelected: true,
				categories: ["hotkeys", "editorAndFileSettings"]
			},
			{
				id: "dailyAndGraph",
				labelKey: "copyChoiceDailyAndGraph",
				descKey: "copyChoiceDailyAndGraphDesc",
				defaultSelected: true,
				categories: ["notesAndTemplates", "graphSettings"]
			}
		]
	},
	{
		labelKey: "copyGroupPlugins",
		descKey: "copyGroupPluginsDesc",
		options: [
			{
				id: "plugins",
				labelKey: "copyChoicePlugins",
				descKey: "copyChoicePluginsDesc",
				defaultSelected: true,
				categories: ["communityPlugins", "corePlugins"]
			}
		]
	}
];

const DEFAULT_COPY_CHOICES = COPY_CATEGORY_GROUPS.flatMap((group) => group.options.filter((option) => option.defaultSelected).map((option) => option.id));
const MODAL_TITLE_STYLES = `
.vault-bloom-modal {
	border-radius: 14px;
	overflow: hidden;
	--vault-bloom-scrollbar-edge-gap: 14px;
	scrollbar-color: color-mix(in srgb, var(--interactive-accent) 36%, var(--background-modifier-border)) transparent;
	scrollbar-width: thin;
}

.vault-bloom-create-modal .modal-title {
	display: none;
}

.vault-bloom-modal .modal-content {
	max-height: calc(85vh - 28px);
	margin: var(--vault-bloom-scrollbar-edge-gap) 0;
	padding: 10px 24px 24px 24px;
	overflow-y: auto;
	overscroll-behavior: contain;
	scrollbar-color: color-mix(in srgb, var(--interactive-accent) 36%, var(--background-modifier-border)) transparent;
	scrollbar-width: thin;
}

.vault-bloom-create-modal .modal-content {
	padding-top: 10px;
}

.vault-bloom-modal .modal-content > p {
	margin-top: 0;
	margin-left: 0;
}

.vault-bloom-modal .modal-content::-webkit-scrollbar {
	width: 8px;
}

.vault-bloom-modal .modal-content::-webkit-scrollbar-button {
	display: none;
	width: 8px;
	height: 0;
}

.vault-bloom-modal .modal-content::-webkit-scrollbar-track {
	background-color: transparent;
}

.vault-bloom-modal .modal-content::-webkit-scrollbar-thumb {
	border: 2px solid transparent;
	border-radius: 999px;
	background-color: color-mix(in srgb, var(--interactive-accent) 38%, var(--background-modifier-border));
	background-clip: content-box;
}

.vault-bloom-modal .modal-content::-webkit-scrollbar-thumb:hover {
	background-color: color-mix(in srgb, var(--interactive-accent) 56%, var(--background-modifier-border));
}

.vault-bloom-source-modal .modal-title {
	margin: 0 32px;
	padding: 32px 0 16px 0;
	border-bottom: 1px solid color-mix(in srgb, var(--background-modifier-border) 82%, var(--text-muted));
	font-size: 1.35em;
	font-weight: 750;
	line-height: 1.25;
}

.vault-bloom-source-modal .modal-content {
	max-height: none;
	margin: 0;
	padding: 16px 32px 32px 32px;
	overflow: visible;
}

.vault-bloom-source-modal .setting-item {
	padding: 18px 0;
}

.vault-bloom-source-modal .setting-item:first-child {
	padding-top: 0;
}

.vault-bloom-modal .vault-bloom-intro {
	margin-bottom: 18px;
}

.vault-bloom-modal .vault-bloom-intro p {
	margin: 0 0 8px 0;
}

.vault-bloom-modal .vault-bloom-section {
	margin: 0 0 26px 0;
	padding: 18px 0 0 0;
	border-top: 1px solid var(--background-modifier-border);
}

.vault-bloom-modal .vault-bloom-section:first-child {
	border-top: 0;
	padding-top: 0;
}

.vault-bloom-modal .vault-bloom-section h2 {
	margin: 0 0 6px 0;
	font-size: 1.18em;
	font-weight: 750;
	line-height: 1.25;
}

.vault-bloom-modal .vault-bloom-section > p {
	margin: 0 0 16px 0;
	color: var(--text-muted);
	font-size: var(--font-ui-small);
}

.vault-bloom-modal .vault-bloom-card {
	margin-left: 0;
	padding: 18px 20px 22px 16px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 12px;
	background: var(--background-secondary);
}

.vault-bloom-modal .vault-bloom-card > .setting-item:first-child {
	padding-top: 0;
}

.vault-bloom-modal .vault-bloom-card-list {
	display: grid;
	gap: 0;
	margin-left: 0;
	padding: 16px 18px;
	border: 1px solid var(--background-modifier-border);
	border-radius: 12px;
	background: var(--background-secondary);
}

.vault-bloom-modal .vault-bloom-card-list:focus-within {
	border-color: var(--interactive-accent);
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 16%, transparent);
}

.vault-bloom-modal .vault-bloom-field-card {
	display: grid;
	gap: 6px;
	padding: 0;
	border: 0;
	border-radius: 0;
	background: transparent;
}

.vault-bloom-modal .vault-bloom-field-card + .vault-bloom-field-card {
	margin-top: 14px;
	padding-top: 14px;
	border-top: 1px solid var(--background-modifier-border);
}

.vault-bloom-modal .vault-bloom-field-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 16px;
	align-items: center;
}

.vault-bloom-modal .vault-bloom-field-copy {
	min-width: 0;
}

.vault-bloom-modal .vault-bloom-field-name {
	font-weight: 650;
	line-height: 1.3;
}

.vault-bloom-modal .vault-bloom-field-desc {
	margin-top: 3px;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: 1.35;
}

.vault-bloom-modal .vault-bloom-field-control {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 8px;
	min-width: 0;
}

.vault-bloom-modal .vault-bloom-field-control input[type="text"] {
	width: min(280px, 100%);
}

.vault-bloom-modal .vault-bloom-field-card.vault-bloom-path-card .vault-bloom-field-row {
	grid-template-columns: minmax(0, 1fr) minmax(220px, 1.2fr);
}

.vault-bloom-modal .vault-bloom-group {
	margin: 0;
	padding: 0 0 0 2px;
	border: 0;
	border-radius: 0;
	background: transparent;
}

.vault-bloom-modal .vault-bloom-group + .vault-bloom-group {
	margin-top: 8px;
	padding-top: 16px;
	border-top: 1px solid color-mix(in srgb, var(--background-modifier-border) 86%, transparent);
}

.vault-bloom-modal .vault-bloom-group:last-child {
	margin-bottom: 0;
}

.vault-bloom-modal .vault-bloom-group:last-child .vault-bloom-option-row:last-child {
	padding-bottom: 0;
}

.vault-bloom-modal .vault-bloom-group h3 {
	margin: 0 0 5px 0;
	font-size: 0.98em;
	font-weight: 750;
	line-height: 1.3;
}

.vault-bloom-modal .vault-bloom-group > p {
	margin: 0 0 12px 0;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
}

.vault-bloom-modal .vault-bloom-option-row {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto;
	gap: 16px;
	align-items: center;
	position: relative;
	padding: 8px 0 8px 18px;
}

.vault-bloom-modal .vault-bloom-option-row::before {
	content: "•";
	position: absolute;
	top: 8px;
	left: 0;
	color: var(--interactive-accent);
	line-height: 1.2;
}

.vault-bloom-modal .vault-bloom-option-row + .vault-bloom-option-row {
	margin-top: 4px;
}

.vault-bloom-modal .vault-bloom-option-name {
	font-size: var(--font-ui-small);
	font-weight: 650;
	line-height: 1.3;
}

.vault-bloom-modal .vault-bloom-option-desc {
	margin-top: 3px;
	color: var(--text-muted);
	font-size: var(--font-ui-smaller);
	line-height: 1.35;
}

.vault-bloom-modal .vault-bloom-card:focus-within {
	border-color: var(--interactive-accent);
	box-shadow: 0 0 0 2px color-mix(in srgb, var(--interactive-accent) 22%, transparent);
}

.vault-bloom-modal .setting-item {
	padding-left: 0;
	padding-right: 0;
}

.vault-bloom-modal .setting-item-info {
	padding-left: 0;
}

.vault-bloom-modal .setting-item-name {
	font-weight: 600;
}

.vault-bloom-modal .vault-bloom-actions {
	margin-left: 0;
	display: flex;
	justify-content: stretch;
}

.vault-bloom-modal .vault-bloom-create-button {
	width: 100%;
	min-height: 42px;
	padding: 8px 18px;
	border-radius: 12px;
	font-size: 1em;
	font-weight: 750;
	line-height: 1.25;
}

@media (max-width: 640px) {
	.vault-bloom-modal .vault-bloom-field-row,
	.vault-bloom-modal .vault-bloom-field-card.vault-bloom-path-card .vault-bloom-field-row {
		grid-template-columns: 1fr;
	}

	.vault-bloom-modal .vault-bloom-field-control {
		justify-content: flex-start;
	}
}
`;

const TRANSLATIONS: Record<Locale, Record<TranslationKey, string>> = {
	"zh-CN": {
		pluginName: "Vault Clone",
		commandCreate: "新建主题仓库",
		ribbonCreate: "新建主题仓库",
		settingsTitle: "Vault Clone",
		settingsLanguage: "界面语言",
		settingsLanguageDesc: "切换插件界面语言。命令名称会在下次重载插件或重启 Obsidian 后刷新。",
		languageAuto: "跟随 Obsidian",
		languageChinese: "中文",
		languageEnglish: "English",
		settingsFlow: "当前链路",
		settingsFlowDesc:
			"当前链路是：点击“新建主题仓库” -> 先选主题来源 -> 再勾选想复制的配置 -> 填写仓库名称和保存位置 -> 插件创建新仓库并复制选中的配置。",
		themePickerPlaceholder: "先选择主题来源",
		themePickerCurrentVault: "当前仓库",
		themePickerFromVault: "来自其他仓库",
		themeDefault: "默认主题",
		themeUnknown: "未知主题",
		themeNamePrefix: "主题：{{themeName}}",
		themeSourceChoose: "选择",
		createTitle: "新建主题仓库",
		createSourceTheme: "主题来源：{{vaultLabel}}",
		createSourceSection: "主题来源",
		createSourceSectionDesc: "刚才选中的仓库会作为这次新建仓库的配置来源。",
		createSourceDropdown: "选择主题来源",
		createSourceDropdownDesc: "可以在这里切换已知仓库",
		createSourcePath: "仓库路径",
		createCopySection: "继承配置",
		createTargetSection: "新仓库信息",
		createTargetSectionDesc: "最后填写新仓库自己的名称和保存位置。",
		createCopyOptions: "想一起带过去的配置",
		createCopyOptionsDesc: "按使用场景选择要继承的配置，不需要理解每一个 .obsidian 文件。",
		copyChoiceLookAndFonts: "主题、字体和配色",
		copyChoiceLookAndFontsDesc: "包含当前主题、已下载主题、字体、字号和强调色。",
		copyChoiceEditingHabits: "快捷键和编辑习惯",
		copyChoiceEditingHabitsDesc: "包含快捷键、编辑器、链接、附件和文件相关偏好。",
		copyChoiceDailyAndGraph: "日记、模板和图谱",
		copyChoiceDailyAndGraphDesc: "包含日记、模板、唯一笔记和全局图谱设置。",
		copyChoicePlugins: "插件和插件配置",
		copyChoicePluginsDesc: "包含第三方插件、插件配置和核心插件开关。",
		copyCategoryTheme: "主题外观",
		copyCategoryThemeDesc: "主题名称、基础配色、强调色，以及已下载的主题文件。",
		copyCategoryFonts: "字体与字号",
		copyCategoryFontsDesc: "界面字体、正文字体、等宽字体和基础字号。",
		copyCategoryCssSnippets: "CSS 片段",
		copyCategoryCssSnippetsDesc: "片段文件夹和已启用片段列表。",
		copyCategoryHotkeys: "快捷键",
		copyCategoryHotkeysDesc: "自定义命令快捷键。",
		copyCategoryCommunityPlugins: "第三方插件与插件配置",
		copyCategoryCommunityPluginsDesc: "已启用的社区插件列表，以及各插件自己的配置文件。",
		copyCategoryCorePlugins: "核心插件开关",
		copyCategoryCorePluginsDesc: "Obsidian 内置插件的启用状态。",
		copyCategoryEditorAndFileSettings: "编辑器与文件设置",
		copyCategoryEditorAndFileSettingsDesc: "编辑器、链接、附件、文件列表等基础偏好。",
		copyCategoryGraphSettings: "图谱设置",
		copyCategoryGraphSettingsDesc: "全局图谱的过滤、颜色和显示方式。",
		copyCategoryNotesAndTemplates: "日记、模板与笔记插件设置",
		copyCategoryNotesAndTemplatesDesc: "日记、模板、唯一笔记等核心功能的配置。",
		copyCategoryWorkspaceLayout: "工作区布局",
		copyCategoryWorkspaceLayoutDesc: "打开的面板和布局状态。通常不建议新仓库默认复制。",
		copyCategoryOtherConfig: "其他零散配置",
		copyCategoryOtherConfigDesc: "命令面板、文件恢复、搜索、同步、发布等未单独列出的顶层配置。",
		copyGroupAppearance: "外观",
		copyGroupAppearanceDesc: "决定新仓库看起来像不像原仓库。",
		copyGroupBehavior: "行为",
		copyGroupBehaviorDesc: "决定写作、编辑和日常使用习惯。",
		copyGroupPlugins: "插件",
		copyGroupPluginsDesc: "影响功能边界的插件开关和配置。",
		createVaultName: "仓库名称",
		createVaultNameDesc: "原生新建仓库里的 Vault Name",
		createVaultNamePlaceholder: "例如：我的新仓库…",
		createLocation: "保存位置",
		createLocationDesc: "原生新建仓库里的位置选择",
		createLocationPlaceholder: "例如：/Users/you/Documents…",
		createBrowse: "浏览",
		createButton: "创建仓库",
		cancelButton: "取消",
		noticeCreated: "已创建仓库“{{vaultName}}”，并应用“{{themeName}}”主题效果。",
		noticeLanguageChanged: "语言设置已保存。命令名称会在下次重载插件或重启 Obsidian 后更新。",
		noticeNoVaults: "没有找到可用的主题来源仓库。",
		errorDesktopOnly: "这个插件只能在桌面端的本地仓库中使用。",
		errorVaultNameRequired: "必须填写仓库名称。",
		errorVaultNameInvalid: "仓库名称不能包含斜杠。",
		errorParentDirectoryRequired: "必须填写保存位置。",
		errorParentDirectoryMissing: "保存位置不存在：{{path}}",
		errorVaultExists: "目标仓库已存在：{{path}}",
		errorSourceMissingConfig: "主题来源仓库缺少 .obsidian 文件夹：{{path}}",
		errorBrowseUnavailable: "当前环境暂时无法打开目录选择器，请直接手动填写路径。",
		errorNoCopyCategories: "至少需要勾选一项要复制的配置。"
	},
	en: {
		pluginName: "Vault Clone",
		commandCreate: "Create themed vault",
		ribbonCreate: "Create themed vault",
		settingsTitle: "Vault Clone",
		settingsLanguage: "Interface language",
		settingsLanguageDesc: "Switch the plugin UI language. Command names refresh after reloading the plugin or restarting Obsidian.",
		languageAuto: "Follow Obsidian",
		languageChinese: "Chinese",
		languageEnglish: "English",
		settingsFlow: "Current flow",
		settingsFlowDesc:
			"Current flow: click “Create themed vault” -> choose the theme source first -> then tick the config categories you want -> fill in the vault name and location -> the plugin creates the vault and copies the selected settings.",
		themePickerPlaceholder: "Choose a theme source first",
		themePickerCurrentVault: "Current vault",
		themePickerFromVault: "From another vault",
		themeDefault: "Default theme",
		themeUnknown: "Unknown theme",
		themeNamePrefix: "Theme: {{themeName}}",
		themeSourceChoose: "Choose",
		createTitle: "Create themed vault",
		createSourceTheme: "Theme source: {{vaultLabel}}",
		createSourceSection: "Theme source",
		createSourceSectionDesc: "The vault you just chose will be used as the source for this new vault.",
		createSourceDropdown: "Choose theme source",
		createSourceDropdownDesc: "Switch to another known vault here if you want a different source theme and config.",
		createSourcePath: "Vault path",
		createCopySection: "Inherited config",
		createTargetSection: "New vault details",
		createTargetSectionDesc: "Finish by choosing the new vault's own name and location.",
		createCopyOptions: "Config to bring over",
		createCopyOptionsDesc: "Choose by usage scenario. You do not need to understand every .obsidian file.",
		copyChoiceLookAndFonts: "Theme, fonts, and colors",
		copyChoiceLookAndFontsDesc: "Current theme, downloaded themes, fonts, font size, and accent color.",
		copyChoiceEditingHabits: "Hotkeys and editing habits",
		copyChoiceEditingHabitsDesc: "Hotkeys, editor, links, attachments, and file-related preferences.",
		copyChoiceDailyAndGraph: "Daily notes, templates, and graph",
		copyChoiceDailyAndGraphDesc: "Daily notes, templates, unique notes, and global graph settings.",
		copyChoicePlugins: "Plugins and plugin config",
		copyChoicePluginsDesc: "Community plugins, plugin config, and core plugin toggles.",
		copyCategoryTheme: "Theme appearance",
		copyCategoryThemeDesc: "Theme name, base color mode, accent color, and downloaded theme files.",
		copyCategoryFonts: "Fonts and size",
		copyCategoryFontsDesc: "Interface font, text font, monospace font, and base font size.",
		copyCategoryCssSnippets: "CSS snippets",
		copyCategoryCssSnippetsDesc: "Snippet folder and enabled snippet list.",
		copyCategoryHotkeys: "Hotkeys",
		copyCategoryHotkeysDesc: "Custom command shortcuts.",
		copyCategoryCommunityPlugins: "Community plugins and plugin config",
		copyCategoryCommunityPluginsDesc: "Enabled community plugin list plus each plugin's own config files.",
		copyCategoryCorePlugins: "Core plugin toggles",
		copyCategoryCorePluginsDesc: "Enabled state for Obsidian's built-in plugins.",
		copyCategoryEditorAndFileSettings: "Editor and file settings",
		copyCategoryEditorAndFileSettingsDesc: "Editor, links, attachments, file list, and other base preferences.",
		copyCategoryGraphSettings: "Graph settings",
		copyCategoryGraphSettingsDesc: "Global graph filters, colors, and display options.",
		copyCategoryNotesAndTemplates: "Daily notes, templates, and note plugin settings",
		copyCategoryNotesAndTemplatesDesc: "Daily notes, templates, unique note creator, and related core feature config.",
		copyCategoryWorkspaceLayout: "Workspace layout",
		copyCategoryWorkspaceLayoutDesc: "Open panes and layout state. Usually not recommended for a brand-new vault.",
		copyCategoryOtherConfig: "Other loose config",
		copyCategoryOtherConfigDesc: "Command palette, file recovery, search, sync, publish, and other top-level config not listed above.",
		copyGroupAppearance: "Appearance",
		copyGroupAppearanceDesc: "Make the new vault look like the source vault.",
		copyGroupBehavior: "Behavior",
		copyGroupBehaviorDesc: "Writing, editing, and everyday usage habits.",
		copyGroupPlugins: "Plugins",
		copyGroupPluginsDesc: "Plugin toggles and plugin-specific configuration.",
		createVaultName: "Vault name",
		createVaultNameDesc: "This matches the native Obsidian create-vault Vault name step.",
		createVaultNamePlaceholder: "For example: My new vault…",
		createLocation: "Location",
		createLocationDesc: "This matches the native Obsidian create-vault Browse location step.",
		createLocationPlaceholder: "For example: /Users/you/Documents…",
		createBrowse: "Browse",
		createButton: "Create vault",
		cancelButton: "Cancel",
		noticeCreated: "Created {{vaultName}} and applied the {{themeName}} theme look.",
		noticeLanguageChanged: "Language saved. Command names will refresh after reloading the plugin or restarting Obsidian.",
		noticeNoVaults: "No usable theme source vaults were found.",
		errorDesktopOnly: "This plugin only works with local desktop vaults.",
		errorVaultNameRequired: "Vault name is required.",
		errorVaultNameInvalid: "Vault name cannot contain path separators.",
		errorParentDirectoryRequired: "Location is required.",
		errorParentDirectoryMissing: "Location does not exist: {{path}}",
		errorVaultExists: "Target vault already exists: {{path}}",
		errorSourceMissingConfig: "Theme source vault has no .obsidian folder: {{path}}",
		errorBrowseUnavailable: "A folder picker is not available here right now. Please type the path manually.",
		errorNoCopyCategories: "Select at least one config category to copy."
	}
};

export default class ThemedVaultCreatorPlugin extends Plugin {
	settings!: VaultThemeCreatorSettings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.injectStyles();

		this.addCommand({
			id: "create-themed-vault",
			name: this.t("commandCreate"),
			callback: async () => {
				await this.startCreateVaultFlow();
			}
		});

		const ribbonIcon = this.addRibbonIcon("copy-plus", this.t("ribbonCreate"), async () => {
			await this.startCreateVaultFlow();
		});
		ribbonIcon.style.order = "80";
		ribbonIcon.setAttribute("aria-label", this.t("ribbonCreate"));

		this.addSettingTab(new ThemedVaultCreatorSettingTab(this.app, this));
	}

	onunload(): void {
		document.getElementById("vault-bloom-styles")?.remove();
	}

	async loadSettings(): Promise<void> {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	getLocale(): Locale {
		if (this.settings.uiLanguage === "zh-CN" || this.settings.uiLanguage === "en") {
			return this.settings.uiLanguage;
		}

		return getLanguage().startsWith("zh") ? "zh-CN" : "en";
	}

	t(key: TranslationKey, vars?: Record<string, string | number>): string {
		let result = TRANSLATIONS[this.getLocale()][key];
		if (!vars) {
			return result;
		}

		for (const [name, value] of Object.entries(vars)) {
			result = result.split(`{{${name}}}`).join(String(value));
		}

		return result;
	}

	private async startCreateVaultFlow(): Promise<void> {
		try {
			const sourceOptions = await this.getThemeSourceOptions();
			const sourceOption = await this.pickThemeSource(sourceOptions);
			if (!sourceOption) {
				return;
			}

			await nextFrame();
			const defaultParentDirectory = path.dirname(this.getCurrentVaultPath());
			const createResult = await new CreateThemedVaultModal(
				this,
				this.app,
				sourceOptions,
				sourceOption,
				defaultParentDirectory
			).openAndWait();
			if (!createResult) {
				return;
			}

			await this.createVaultFromThemeSource(createResult.sourceOption, createResult);
		} catch (error) {
			this.showError(error);
		}
	}

	private getCurrentVaultPath(): string {
		const adapter = this.app.vault.adapter;
		if (!(adapter instanceof FileSystemAdapter)) {
			throw new Error(this.t("errorDesktopOnly"));
		}

		return path.resolve(adapter.getBasePath());
	}

	private async pickThemeSource(options: ThemeSourceOption[]): Promise<ThemeSourceOption | null> {
		if (options.length === 0) {
			new Notice(this.t("noticeNoVaults"));
			return null;
		}

		return new Promise((resolve) => {
			new ThemeSourceModal(this.app, this, options, resolve).open();
		});
	}

	private async getThemeSourceOptions(): Promise<ThemeSourceOption[]> {
		const currentVaultPath = this.getCurrentVaultPath();
		const knownVaultPaths = await this.getKnownVaultPaths();
		const paths = Array.from(new Set([currentVaultPath, ...knownVaultPaths]));
		const options: ThemeSourceOption[] = [];

		for (const vaultPath of paths) {
			if (!(await this.isVaultDirectory(vaultPath))) {
				continue;
			}

			options.push({
				vaultPath,
				vaultName: path.basename(vaultPath),
				themeName: await this.readThemeName(vaultPath),
				isCurrentVault: path.resolve(vaultPath) === currentVaultPath
			});
		}

		return options.sort((left, right) => {
			if (left.isCurrentVault && !right.isCurrentVault) {
				return -1;
			}

			if (!left.isCurrentVault && right.isCurrentVault) {
				return 1;
			}

			return left.vaultName.localeCompare(right.vaultName);
		});
	}

	private async getKnownVaultPaths(): Promise<string[]> {
		const configPath = this.getVaultRegistryConfigPath();
		if (!existsSync(configPath)) {
			return [];
		}

		try {
			const raw = await fs.readFile(configPath, "utf8");
			const data = JSON.parse(raw) as { vaults?: Record<string, { path?: string }> };
			const vaultEntries = Object.values(data.vaults ?? {});
			return vaultEntries
				.map((entry) => (entry.path ? path.resolve(entry.path) : ""))
				.filter(Boolean);
		} catch {
			return [];
		}
	}

	private getVaultRegistryConfigPath(): string {
		const home = os.homedir();
		switch (process.platform) {
			case "darwin":
				return path.join(home, "Library", "Application Support", "obsidian", "obsidian.json");
			case "win32":
				return path.join(process.env.APPDATA ?? path.join(home, "AppData", "Roaming"), "obsidian", "obsidian.json");
			default:
				return path.join(process.env.XDG_CONFIG_HOME ?? path.join(home, ".config"), "obsidian", "obsidian.json");
		}
	}

	private async readThemeName(vaultPath: string): Promise<string> {
		const appearancePath = path.join(vaultPath, CONFIG_FOLDER_NAME, "appearance.json");
		if (!existsSync(appearancePath)) {
			return this.t("themeDefault");
		}

		try {
			const raw = await fs.readFile(appearancePath, "utf8");
			const data = JSON.parse(raw) as { cssTheme?: string };
			if (typeof data.cssTheme === "string" && data.cssTheme.trim()) {
				return data.cssTheme.trim();
			}
			return this.t("themeDefault");
		} catch {
			return this.t("themeUnknown");
		}
	}

	private async createVaultFromThemeSource(sourceOption: ThemeSourceOption, form: CreateVaultFormResult): Promise<void> {
		const vaultName = form.vaultName.trim();
		if (!vaultName) {
			throw new Error(this.t("errorVaultNameRequired"));
		}

		if (/[\\/]/.test(vaultName)) {
			throw new Error(this.t("errorVaultNameInvalid"));
		}

		const parentDirectory = form.parentDirectory.trim();
		if (!parentDirectory) {
			throw new Error(this.t("errorParentDirectoryRequired"));
		}

		const resolvedParentDirectory = path.resolve(parentDirectory.replace(/^~(?=$|\/|\\)/, os.homedir()));
		if (!existsSync(resolvedParentDirectory)) {
			throw new Error(this.t("errorParentDirectoryMissing", { path: resolvedParentDirectory }));
		}

		const targetVaultPath = path.join(resolvedParentDirectory, vaultName);
		if (existsSync(targetVaultPath)) {
			throw new Error(this.t("errorVaultExists", { path: targetVaultPath }));
		}

		await fs.mkdir(targetVaultPath, { recursive: false });
		await this.copySelectedConfiguration(sourceOption.vaultPath, targetVaultPath, form.copyCategories);
		await this.addVaultToRegistry(targetVaultPath);
		await this.openVaultInObsidian(targetVaultPath);

		new Notice(
			this.t("noticeCreated", {
				vaultName,
				themeName: sourceOption.themeName
			}),
			8000
		);
	}

	private async openVaultInObsidian(targetVaultPath: string): Promise<void> {
		switch (process.platform) {
			case "darwin":
				await execFileAsync("open", ["-a", "Obsidian", targetVaultPath]);
				return;
			case "win32":
				await execFileAsync("cmd", ["/c", "start", "", `obsidian://open?vault=${encodeURIComponent(path.basename(targetVaultPath))}`]);
				return;
			default:
				await execFileAsync("xdg-open", [`obsidian://open?vault=${encodeURIComponent(path.basename(targetVaultPath))}`]);
		}
	}

	private injectStyles(): void {
		if (document.getElementById("vault-bloom-styles")) {
			return;
		}

		const style = document.createElement("style");
		style.id = "vault-bloom-styles";
		style.textContent = MODAL_TITLE_STYLES;
		document.head.appendChild(style);
	}

	private async copySelectedConfiguration(
		sourceVaultPath: string,
		targetVaultPath: string,
		copyCategories: CopyCategory[]
	): Promise<void> {
		if (copyCategories.length === 0) {
			throw new Error(this.t("errorNoCopyCategories"));
		}

		const sourceConfigPath = path.join(sourceVaultPath, CONFIG_FOLDER_NAME);
		if (!(await this.isVaultDirectory(sourceVaultPath))) {
			throw new Error(this.t("errorSourceMissingConfig", { path: sourceVaultPath }));
		}

		const targetConfigPath = path.join(targetVaultPath, CONFIG_FOLDER_NAME);
		await fs.mkdir(targetConfigPath, { recursive: true });

		for (const category of copyCategories) {
			await this.copyCategory(sourceConfigPath, targetConfigPath, category);
		}
	}

	private async copyCategory(sourceConfigPath: string, targetConfigPath: string, category: CopyCategory): Promise<void> {
		switch (category) {
			case "theme":
				await this.copyAppearanceKeys(sourceConfigPath, targetConfigPath, THEME_APPEARANCE_KEYS);
				await this.copyDirectoryIfExists(sourceConfigPath, targetConfigPath, THEMES_DIR);
				break;
			case "fonts":
				await this.copyAppearanceKeys(sourceConfigPath, targetConfigPath, FONT_APPEARANCE_KEYS);
				break;
			case "cssSnippets":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, COMMUNITY_CSS_SNIPPETS_JSON);
				await this.copyDirectoryIfExists(sourceConfigPath, targetConfigPath, SNIPPETS_DIR);
				break;
			case "hotkeys":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, HOTKEYS_JSON);
				break;
			case "communityPlugins":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, COMMUNITY_PLUGINS_JSON);
				await this.copyDirectoryIfExists(sourceConfigPath, targetConfigPath, PLUGINS_DIR);
				break;
			case "corePlugins":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, CORE_PLUGINS_JSON);
				break;
			case "editorAndFileSettings":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, APP_JSON);
				break;
			case "graphSettings":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, GRAPH_JSON);
				break;
			case "notesAndTemplates":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, DAILY_NOTES_JSON);
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, TEMPLATES_JSON);
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, UNIQUE_NOTE_CREATOR_JSON);
				break;
			case "workspaceLayout":
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, WORKSPACE_JSON);
				await this.copyJsonFileIfExists(sourceConfigPath, targetConfigPath, WORKSPACE_MOBILE_JSON);
				break;
			case "otherConfig":
				await this.copyOtherConfig(sourceConfigPath, targetConfigPath);
				break;
		}
	}

	private async copyAppearanceKeys(sourceConfigPath: string, targetConfigPath: string, keys: string[]): Promise<void> {
		const appearancePath = path.join(sourceConfigPath, APPEARANCE_JSON);
		if (!existsSync(appearancePath)) {
			return;
		}

		try {
			const sourceData = JSON.parse(await fs.readFile(appearancePath, "utf8")) as Record<string, unknown>;
			const targetPath = path.join(targetConfigPath, APPEARANCE_JSON);
			const targetData = existsSync(targetPath)
				? (JSON.parse(await fs.readFile(targetPath, "utf8")) as Record<string, unknown>)
				: {};

			for (const key of keys) {
				if (key in sourceData) {
					targetData[key] = sourceData[key];
				}
			}

			await fs.writeFile(targetPath, JSON.stringify(targetData, null, 2));
		} catch {
			await fs.copyFile(appearancePath, path.join(targetConfigPath, APPEARANCE_JSON));
		}
	}

	private async copyJsonFileIfExists(sourceConfigPath: string, targetConfigPath: string, fileName: string): Promise<void> {
		const sourcePath = path.join(sourceConfigPath, fileName);
		if (existsSync(sourcePath)) {
			await fs.copyFile(sourcePath, path.join(targetConfigPath, fileName));
		}
	}

	private async copyDirectoryIfExists(sourceConfigPath: string, targetConfigPath: string, directoryName: string): Promise<void> {
		const sourceDirectoryPath = path.join(sourceConfigPath, directoryName);
		if (existsSync(sourceDirectoryPath)) {
			await copyDirectoryRecursive(sourceDirectoryPath, path.join(targetConfigPath, directoryName));
		}
	}

	private async copyOtherConfig(sourceConfigPath: string, targetConfigPath: string): Promise<void> {
		const handledEntries = new Set([
			APP_JSON,
			APPEARANCE_JSON,
			COMMUNITY_CSS_SNIPPETS_JSON,
			COMMUNITY_PLUGINS_JSON,
			CORE_PLUGINS_JSON,
			GRAPH_JSON,
			HOTKEYS_JSON,
			DAILY_NOTES_JSON,
			TEMPLATES_JSON,
			UNIQUE_NOTE_CREATOR_JSON,
			WORKSPACE_JSON,
			WORKSPACE_MOBILE_JSON,
			PLUGINS_DIR,
			SNIPPETS_DIR,
			THEMES_DIR
		]);
		const entries = await fs.readdir(sourceConfigPath, { withFileTypes: true });
		for (const entry of entries) {
			if (handledEntries.has(entry.name) || entry.name === "cache" || entry.name === ".DS_Store") {
				continue;
			}
			if (entry.isDirectory()) {
				await copyDirectoryRecursive(path.join(sourceConfigPath, entry.name), path.join(targetConfigPath, entry.name));
				continue;
			}
			const sourcePath = path.join(sourceConfigPath, entry.name);
			const targetPath = path.join(targetConfigPath, entry.name);
			if (existsSync(sourcePath)) {
				await fs.copyFile(sourcePath, targetPath);
			}
		}
	}

	private async addVaultToRegistry(targetVaultPath: string): Promise<void> {
		const configPath = this.getVaultRegistryConfigPath();
		const configDirectory = path.dirname(configPath);
		await fs.mkdir(configDirectory, { recursive: true });

		let data: { vaults?: Record<string, { path: string; ts: number }> } = {};
		if (existsSync(configPath)) {
			try {
				data = JSON.parse(await fs.readFile(configPath, "utf8")) as typeof data;
			} catch {
				data = {};
			}
		}

		const vaults = data.vaults ?? {};
		const normalizedTargetPath = path.resolve(targetVaultPath);
		const alreadyPresent = Object.values(vaults).some((entry) => path.resolve(entry.path) === normalizedTargetPath);
		if (!alreadyPresent) {
			vaults[randomId()] = {
				path: normalizedTargetPath,
				ts: Date.now()
			};
		}

		data.vaults = vaults;
		await fs.writeFile(configPath, JSON.stringify(data, null, 2));
	}

	private async isVaultDirectory(targetPath: string): Promise<boolean> {
		try {
			const stat = await fs.stat(path.join(targetPath, CONFIG_FOLDER_NAME));
			return stat.isDirectory();
		} catch {
			return false;
		}
	}

	private showError(error: unknown): void {
		const message = error instanceof Error ? error.message : String(error);
		console.error(error);
		new Notice(message, 8000);
	}
}

class ThemeSourceModal extends Modal {
	private readonly plugin: ThemedVaultCreatorPlugin;
	private readonly options: ThemeSourceOption[];
	private readonly onChoose: (value: ThemeSourceOption | null) => void;
	private resolved = false;

	constructor(
		app: App,
		plugin: ThemedVaultCreatorPlugin,
		options: ThemeSourceOption[],
		onChoose: (value: ThemeSourceOption | null) => void
	) {
		super(app);
		this.plugin = plugin;
		this.options = options;
		this.onChoose = onChoose;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(this.plugin.t("themePickerPlaceholder"));
		this.modalEl.addClass("vault-bloom-modal");
		this.modalEl.addClass("vault-bloom-source-modal");

		for (const option of this.options) {
			const sourceLabel = option.isCurrentVault
				? this.plugin.t("themePickerCurrentVault")
				: this.plugin.t("themePickerFromVault");

			new Setting(contentEl)
				.setName(`${sourceLabel} · ${option.vaultName}`)
				.setDesc(this.plugin.t("themeNamePrefix", { themeName: option.themeName }))
				.addButton((button) =>
					button
						.setButtonText(this.plugin.t("themeSourceChoose"))
						.setCta()
						.onClick(() => {
							this.resolved = true;
							this.close();
							this.onChoose(option);
						})
				);
		}
	}

	onClose(): void {
		super.onClose();
		if (!this.resolved) {
			this.onChoose(null);
		}
	}
}

class CreateThemedVaultModal extends Modal {
	private readonly plugin: ThemedVaultCreatorPlugin;
	private readonly sourceOptions: ThemeSourceOption[];
	private resolvePromise!: (value: CreateVaultFormResult | null) => void;
	private readonly resultPromise: Promise<CreateVaultFormResult | null>;
	private selectedSourceVaultPath: string;
	private vaultName = "";
	private parentDirectory: string;
	private copyChoices = new Set<CopyChoice>(DEFAULT_COPY_CHOICES);
	private resolved = false;

	constructor(
		plugin: ThemedVaultCreatorPlugin,
		app: App,
		sourceOptions: ThemeSourceOption[],
		initialSourceOption: ThemeSourceOption,
		defaultParentDirectory: string
	) {
		super(app);
		this.plugin = plugin;
		this.sourceOptions = sourceOptions;
		this.selectedSourceVaultPath = initialSourceOption.vaultPath;
		this.parentDirectory = defaultParentDirectory;
		this.resultPromise = new Promise((resolve) => {
			this.resolvePromise = resolve;
		});
	}

	openAndWait(): Promise<CreateVaultFormResult | null> {
		this.open();
		return this.resultPromise;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.empty();
		this.titleEl.setText(this.plugin.t("createTitle"));
		this.modalEl.addClass("vault-bloom-modal");
		this.modalEl.addClass("vault-bloom-create-modal");
		const selectedSourceOption = this.getSelectedSourceOption();

		const sourceSection = contentEl.createDiv({ cls: "vault-bloom-section" });
		sourceSection.createEl("h2", { text: this.plugin.t("createSourceSection") });
		sourceSection.createEl("p", { text: this.plugin.t("createSourceSectionDesc") });
		const sourcePicker = sourceSection.createDiv({ cls: "vault-bloom-card-list" });
		this.createFieldCard(sourcePicker, {
			name: this.plugin.t("createSourceDropdown"),
			desc: this.plugin.t("createSourceDropdownDesc"),
			control: (controlEl) => {
				const dropdown = new DropdownComponent(controlEl);
				for (const option of this.sourceOptions) {
					dropdown.addOption(option.vaultPath, `${option.vaultName} · ${option.themeName}`);
				}
				dropdown.setValue(this.selectedSourceVaultPath);
				dropdown.onChange((value) => {
					this.selectedSourceVaultPath = value;
					this.onOpen();
				});
			}
		});

		this.createFieldCard(sourcePicker, {
			name: this.plugin.t("createSourceTheme", {
				vaultLabel: `${selectedSourceOption.vaultName} · ${selectedSourceOption.themeName}`
			}),
			desc: `${this.plugin.t("createSourcePath")}：${selectedSourceOption.vaultPath}`
		});

		const copySection = contentEl.createDiv({ cls: "vault-bloom-section" });
		copySection.createEl("h2", { text: this.plugin.t("createCopySection") });
		copySection.createEl("p", {
			text: this.plugin.t("createCopyOptionsDesc")
		});
		const copyCard = copySection.createDiv({ cls: "vault-bloom-card" });

		for (const group of COPY_CATEGORY_GROUPS) {
			const groupEl = copyCard.createDiv({ cls: "vault-bloom-group" });
			groupEl.createEl("h3", { text: this.plugin.t(group.labelKey) });
			groupEl.createEl("p", { text: this.plugin.t(group.descKey) });

			for (const option of group.options) {
				this.createCopyOptionRow(groupEl, option);
			}
		}

		const targetSection = contentEl.createDiv({ cls: "vault-bloom-section" });
		targetSection.createEl("h2", { text: this.plugin.t("createTargetSection") });
		targetSection.createEl("p", { text: this.plugin.t("createTargetSectionDesc") });
		const targetCard = targetSection.createDiv({ cls: "vault-bloom-card-list" });

		this.createFieldCard(targetCard, {
			name: this.plugin.t("createVaultName"),
			desc: this.plugin.t("createVaultNameDesc"),
			control: (controlEl) => {
				const text = new TextComponent(controlEl);
				text
					.setPlaceholder(this.plugin.t("createVaultNamePlaceholder"))
					.setValue(this.vaultName)
					.onChange((value) => {
						this.vaultName = value;
					});
				text.inputEl.name = "vault-name";
				text.inputEl.autocomplete = "off";
				text.inputEl.setAttribute("aria-label", this.plugin.t("createVaultName"));
			}
		});

		this.createFieldCard(targetCard, {
			name: this.plugin.t("createLocation"),
			desc: this.plugin.t("createLocationDesc"),
			className: "vault-bloom-path-card",
			control: (controlEl) => {
				const text = new TextComponent(controlEl);
				text
					.setPlaceholder(this.plugin.t("createLocationPlaceholder"))
					.setValue(this.parentDirectory)
					.onChange((value) => {
						this.parentDirectory = value;
					});
				text.inputEl.name = "vault-location";
				text.inputEl.autocomplete = "street-address";
				text.inputEl.setAttribute("aria-label", this.plugin.t("createLocation"));

				new ButtonComponent(controlEl).setButtonText(this.plugin.t("createBrowse")).onClick(async () => {
					const selectedPath = await browseForDirectory(this.parentDirectory);
					if (selectedPath) {
						this.parentDirectory = selectedPath;
						this.onOpen();
					}
				});
			}
		});

		const actionsEl = contentEl.createDiv({ cls: "vault-bloom-actions" });
		new ButtonComponent(actionsEl)
			.setButtonText(this.plugin.t("createButton"))
			.setCta()
			.setClass("vault-bloom-create-button")
			.onClick(() => {
				this.resolved = true;
				this.close();
				this.resolvePromise({
					sourceOption: this.getSelectedSourceOption(),
					vaultName: this.vaultName,
					parentDirectory: this.parentDirectory,
					copyCategories: this.getSelectedCopyCategories()
				});
			});
	}

	private createFieldCard(
		parentEl: HTMLElement,
		options: {
			name: string;
			desc: string;
			className?: string;
			control?: (controlEl: HTMLElement) => void;
		}
	): void {
		const cardEl = parentEl.createDiv({
			cls: ["vault-bloom-field-card", options.className].filter(Boolean).join(" ")
		});
		const rowEl = cardEl.createDiv({ cls: "vault-bloom-field-row" });
		const copyEl = rowEl.createDiv({ cls: "vault-bloom-field-copy" });
		copyEl.createDiv({ cls: "vault-bloom-field-name", text: options.name });
		copyEl.createDiv({ cls: "vault-bloom-field-desc", text: options.desc });
		if (options.control) {
			const controlEl = rowEl.createDiv({ cls: "vault-bloom-field-control" });
			options.control(controlEl);
		}
	}

	private createCopyOptionRow(parentEl: HTMLElement, option: CopyCategoryOption): void {
		const rowEl = parentEl.createDiv({ cls: "vault-bloom-option-row" });
		const copyEl = rowEl.createDiv({ cls: "vault-bloom-option-copy" });
		copyEl.createDiv({ cls: "vault-bloom-option-name", text: this.plugin.t(option.labelKey) });
		copyEl.createDiv({ cls: "vault-bloom-option-desc", text: this.plugin.t(option.descKey) });
		const controlEl = rowEl.createDiv({ cls: "vault-bloom-option-control" });
		new ToggleComponent(controlEl).setValue(this.copyChoices.has(option.id)).onChange((value) => {
			if (value) {
				this.copyChoices.add(option.id);
			} else {
				this.copyChoices.delete(option.id);
			}
		});
	}

	private getSelectedCopyCategories(): CopyCategory[] {
		const categories = new Set<CopyCategory>();
		for (const group of COPY_CATEGORY_GROUPS) {
			for (const option of group.options) {
				if (!this.copyChoices.has(option.id)) {
					continue;
				}
				for (const category of option.categories) {
					categories.add(category);
				}
			}
		}
		return Array.from(categories);
	}

	private getSelectedSourceOption(): ThemeSourceOption {
		return (
			this.sourceOptions.find((option) => option.vaultPath === this.selectedSourceVaultPath) ??
			this.sourceOptions[0]
		);
	}

	onClose(): void {
		super.onClose();
		if (!this.resolved) {
			this.resolvePromise(null);
		}
	}
}

class ThemedVaultCreatorSettingTab extends PluginSettingTab {
	private readonly plugin: ThemedVaultCreatorPlugin;

	constructor(app: App, plugin: ThemedVaultCreatorPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl("h2", { text: this.plugin.t("settingsTitle") });

		new Setting(containerEl)
			.setName(this.plugin.t("settingsLanguage"))
			.setDesc(this.plugin.t("settingsLanguageDesc"))
			.addDropdown((dropdown) => {
				dropdown
					.addOption("auto", this.plugin.t("languageAuto"))
					.addOption("zh-CN", this.plugin.t("languageChinese"))
					.addOption("en", this.plugin.t("languageEnglish"))
					.setValue(this.plugin.settings.uiLanguage)
					.onChange(async (value) => {
						this.plugin.settings.uiLanguage = value as "auto" | Locale;
						await this.plugin.saveSettings();
						new Notice(this.plugin.t("noticeLanguageChanged"));
						this.display();
					});
			});

		new Setting(containerEl).setName(this.plugin.t("settingsFlow")).setDesc(this.plugin.t("settingsFlowDesc"));
	}
}

async function copyDirectoryRecursive(
	sourceDirectory: string,
	targetDirectory: string,
	shouldCopyEntry: (entryName: string) => boolean = () => true
): Promise<void> {
	await fs.mkdir(targetDirectory, { recursive: true });
	const entries = await fs.readdir(sourceDirectory, { withFileTypes: true });

	for (const entry of entries) {
		if (!shouldCopyEntry(entry.name)) {
			continue;
		}

		const sourcePath = path.join(sourceDirectory, entry.name);
		const targetPath = path.join(targetDirectory, entry.name);

		if (entry.isDirectory()) {
			await copyDirectoryRecursive(sourcePath, targetPath, shouldCopyEntry);
			continue;
		}

		await fs.copyFile(sourcePath, targetPath);
	}
}

async function browseForDirectory(currentPath: string): Promise<string | null> {
	try {
		switch (process.platform) {
			case "darwin":
				return await browseForDirectoryOnMac(currentPath);
			case "win32":
				return await browseForDirectoryOnWindows(currentPath);
			default:
				return await browseForDirectoryOnLinux(currentPath);
		}
	} catch {
		return null;
	}
}

async function browseForDirectoryOnMac(currentPath: string): Promise<string | null> {
	const script = existsSync(currentPath)
		? [
				"-e",
				`set selectedFolder to choose folder with prompt "Choose a folder for the new vault" default location POSIX file "${escapeAppleScript(currentPath)}"`,
				"-e",
				"POSIX path of selectedFolder"
		  ]
		: ["-e", 'set selectedFolder to choose folder with prompt "Choose a folder for the new vault"', "-e", "POSIX path of selectedFolder"];

	const { stdout } = await execFileAsync("osascript", script);
	const selectedPath = stdout.trim();
	return selectedPath || null;
}

async function browseForDirectoryOnWindows(currentPath: string): Promise<string | null> {
	const sanitized = currentPath.replace(/'/g, "''");
	const script = [
		"Add-Type -AssemblyName System.Windows.Forms",
		"$dialog = New-Object System.Windows.Forms.FolderBrowserDialog",
		"$dialog.Description = 'Choose a folder for the new vault'",
		existsSync(currentPath) ? `$dialog.SelectedPath = '${sanitized}'` : "",
		"if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }"
	]
		.filter(Boolean)
		.join(";");

	const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
	const selectedPath = stdout.trim();
	return selectedPath || null;
}

async function browseForDirectoryOnLinux(currentPath: string): Promise<string | null> {
	const args = ["--file-selection", "--directory", "--title=Choose a folder for the new vault"];
	if (existsSync(currentPath)) {
		args.push(`--filename=${currentPath}/`);
	}

	const { stdout } = await execFileAsync("zenity", args);
	const selectedPath = stdout.trim();
	return selectedPath || null;
}

function randomId(): string {
	return Math.random().toString(16).slice(2, 18);
}

function escapeAppleScript(value: string): string {
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function nextFrame(): Promise<void> {
	return new Promise((resolve) => {
		window.setTimeout(resolve, 0);
	});
}
