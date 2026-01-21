import React, { useState } from 'react';
import { useStore } from '../store/useStore';
import {
  Palette,
  Plus,
  Trash2,
  ChevronRight,
  User,
  Settings as SettingsIcon,
  Check,
  Search,
  Sliders,
  Grid,
  X,
  Undo2,
  Save,
  Layout,
  Tag
} from 'lucide-react';
import { DEFAULT_IDEA_CONFIGS } from '../lib/idea-utils';
import { IdeaConfig, ThemePalette } from '../types';
import { THEMES } from '../lib/themes';


const CSS_COLORS = [
  "AliceBlue", "AntiqueWhite", "Aqua", "Aquamarine", "Azure", "Beige", "Bisque", "Black", "BlanchedAlmond", "Blue", "BlueViolet", "Brown", "BurlyWood", "CadetBlue", "Chartreuse", "Chocolate", "Coral", "CornflowerBlue", "Cornsilk", "Crimson", "Cyan", "DarkBlue", "DarkCyan", "DarkGoldenRod", "DarkGray", "DarkGreen", "DarkKhaki", "DarkMagenta", "DarkOliveGreen", "DarkOrange", "DarkOrchid", "DarkRed", "DarkSalmon", "DarkSeaGreen", "DarkSlateBlue", "DarkSlateGray", "DarkViolet", "DeepPink", "DeepSkyBlue", "DimGray", "DodgerBlue", "FireBrick", "FloralWhite", "ForestGreen", "Fuchsia", "Gainsboro", "GhostWhite", "Gold", "GoldenRod", "Gray", "Green", "GreenYellow", "HoneyDew", "HotPink", "IndianRed", "Indigo", "Ivory", "Khaki", "Lavender", "LavenderBlush", "LawnGreen", "LemonChiffon", "LightBlue", "LightCoral", "LightCyan", "LightGoldenRodYellow", "LightGray", "LightGreen", "LightPink", "LightSalmon", "LightSeaGreen", "LightSkyBlue", "LightSlateGray", "LightSteelBlue", "LightYellow", "Lime", "LimeGreen", "Linen", "Magenta", "Maroon", "MediumAquaMarine", "MediumBlue", "MediumOrchid", "MediumPurple", "MediumSeaGreen", "MediumSlateBlue", "MediumSpringGreen", "MediumTurquoise", "MediumVioletRed", "MidnightBlue", "MintCream", "MistyRose", "Moccasin", "NavajoWhite", "Navy", "OldLace", "Olive", "OliveDrab", "Orange", "OrangeRed", "Orchid", "PaleGoldenRod", "PaleGreen", "PaleTurquoise", "PaleVioletRed", "PapayaWhip", "PeachPuff", "Peru", "Pink", "Plum", "PowderBlue", "Purple", "RebeccaPurple", "Red", "RosyBrown", "RoyalBlue", "SaddleBrown", "Salmon", "SandyBrown", "SeaGreen", "SeaShell", "Sienna", "Silver", "SkyBlue", "SlateBlue", "SlateGray", "Snow", "SpringGreen", "SteelBlue", "Tan", "Teal", "Thistle", "Tomato", "Turquoise", "Violet", "Wheat", "White", "WhiteSmoke", "Yellow", "YellowGreen"
];

const Settings: React.FC = () => {
  const { data, updateGlobalCategories, updatePersonalSettings, showToast } = useStore();
  const [categories, setCategories] = useState<string[]>(data.globalNoteCategories);
  const [personalEntities, setPersonalEntities] = useState<string[]>(data.currentUser?.personalEntities || []);
  const [ideaConfigs, setIdeaConfigs] = useState<IdeaConfig[]>(data.currentUser?.ideaConfigs || DEFAULT_IDEA_CONFIGS);
  const [theme, setTheme] = useState<ThemePalette>(data.currentUser?.theme || 'default');
  const [newCat, setNewCat] = useState('');
  const [newEntity, setNewEntity] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [customTheme, setCustomTheme] = useState<any>(data.currentUser?.customTheme || {});
  const [themeAdjustments, setThemeAdjustments] = useState<Record<string, { base?: string, h: number, l: number, s: number }>>(data.currentUser?.themeAdjustments || {});
  const [showColorModal, setShowColorModal] = useState(false);
  const [activeProperty, setActiveProperty] = useState<{ key: string, label: string } | null>(null);
  const [colorAdjust, setColorAdjust] = useState({ h: 0, s: 50, l: 50 });
  const [selectedSearchName, setSelectedSearchName] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [initialState, setInitialState] = useState<{ hex: string, adj: any } | null>(null);

  const MASTER_EMAIL = 'fernando.mora.uk@gmail.com';
  const isMaster = data.currentUser?.email === MASTER_EMAIL;

  React.useEffect(() => {
    document.title = 'Settings | Idea-CRM';
    return () => { document.title = 'IdeaCRM Tracker'; };
  }, []);

  React.useEffect(() => {
    if (data.currentUser) {
      if (data.globalNoteCategories.length > 0) setCategories(data.globalNoteCategories);
      const serverEntities = data.currentUser.personalEntities;
      if (Array.isArray(serverEntities) && serverEntities.length > 0) {
        setPersonalEntities(serverEntities);
      }
      const serverConfigs = data.currentUser.ideaConfigs;
      if (Array.isArray(serverConfigs) && serverConfigs.length > 0) {
        setIdeaConfigs(serverConfigs);
      }
      if (data.currentUser.theme) {
        setTheme(data.currentUser.theme);
      }
      if (data.currentUser.customTheme) {
        setCustomTheme(data.currentUser.customTheme);
      }
      if (data.currentUser.themeAdjustments) {
        setThemeAdjustments(data.currentUser.themeAdjustments);
      }
    }
  }, [data.currentUser?.id]);

  // Debounced Auto-save
  React.useEffect(() => {
    const timer = setTimeout(async () => {
      if (!data.currentUser) return;
      setIsSaving(true);
      try {
        await updatePersonalSettings({
          personalEntities: personalEntities.filter(e => e.trim() !== ''),
          ideaConfigs: ideaConfigs,
          noteCategories: categories.filter(c => c.trim() !== ''),
          theme: theme,
          customTheme: customTheme,
          themeAdjustments: themeAdjustments
        } as any);
      } finally {
        setTimeout(() => setIsSaving(false), 1000);
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [personalEntities, ideaConfigs, categories, theme, customTheme]);

  const addIdeaType = () => {
    setIdeaConfigs([...ideaConfigs, { type: 'New Type', stages: ['Backlog', 'Done'] }]);
  };

  const removeIdeaType = (index: number) => {
    setIdeaConfigs(ideaConfigs.filter((_, i) => i !== index));
  };

  const updateIdeaType = (index: number, type: string) => {
    const next = [...ideaConfigs];
    next[index].type = type;
    setIdeaConfigs(next);
  };

  const addStage = (typeIndex: number) => {
    const next = [...ideaConfigs];
    if (next[typeIndex].stages.length >= 5) {
      showToast('Max 5 stages allowed for best visibility', 'info');
      return;
    }
    next[typeIndex].stages.push('New Stage');
    setIdeaConfigs(next);
  };

  const removeStage = (typeIndex: number, stageIndex: number) => {
    const next = [...ideaConfigs];
    if (next[typeIndex].stages.length <= 2) {
      showToast('Min 2 stages required (e.g. Start & Finish)', 'info');
      return;
    }
    next[typeIndex].stages = next[typeIndex].stages.filter((_, i) => i !== stageIndex);
    setIdeaConfigs(next);
  };

  const updateStage = (typeIndex: number, stageIndex: number, value: string) => {
    const next = [...ideaConfigs];
    next[typeIndex].stages[stageIndex] = value;
    setIdeaConfigs(next);
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
          <p className="text-gray-500 mt-1">Configure your personal workspace</p>
        </div>
        <div className="flex items-center gap-3">
          {isSaving ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest animate-pulse border border-emerald-100">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Saving Changes
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 text-gray-400 rounded-xl text-xs font-black uppercase tracking-widest border border-gray-100 italic">
              All Changes Saved
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* User Info */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-2xl ${data.currentUser?.avatarColor || 'bg-gray-600'} flex items-center justify-center text-white text-2xl font-bold`}>
              {data.currentUser?.name[0]}
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">{data.currentUser?.name}</h2>
              <p className="text-sm text-gray-500">{data.currentUser?.email}</p>
            </div>
          </div>
        </section>

        {/* Theme Palette Selection */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center gap-3 mb-6">
            <Palette className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-lg font-bold">Workspace Appearance</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.values(THEMES).map((palette) => (
              <button
                key={palette.id}
                onClick={() => setTheme(palette.id)}
                className={`relative flex flex-col p-4 rounded-2xl border-2 transition-all text-left group ${theme === palette.id ? 'border-indigo-500 bg-indigo-50/30' : 'border-gray-100 hover:border-indigo-200 bg-white'}`}
              >
                {theme === palette.id && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-indigo-600 rounded-full flex items-center justify-center shadow-lg">
                    <Check className="w-3 h-3 text-white" />
                  </div>
                )}
                <span className={`text-xs font-black uppercase tracking-widest mb-3 ${theme === palette.id ? 'text-indigo-600' : 'text-gray-400 group-hover:text-gray-600'}`}>
                  {palette.name}
                </span>

                <div className="flex gap-1.5 h-12 w-full rounded-xl overflow-hidden border border-gray-100">
                  <div className="flex-1" style={{ backgroundColor: palette.primary }} title="Icons & Primary" />
                  <div className="flex-1" style={{ backgroundColor: palette.secondary }} title="Working Areas" />
                  <div className="flex-1" style={{ backgroundColor: palette.followUp }} title="Follow ups" />
                  <div className="flex-1" style={{ backgroundColor: palette.accent }} title="Accents" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {data.currentUser?.email === 'fernando.mora.uk@gmail.com' && (
          <section className="bg-indigo-50/20 rounded-[2.5rem] border border-indigo-100 p-8 shadow-sm col-span-1 lg:col-span-2 overflow-hidden relative group/master">
            <div className="flex items-center justify-between mb-8 relative z-10">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-white border border-indigo-100 shadow-sm">
                  <Palette className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">System Palette Architect</h2>
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Administrative implementation tools</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setCustomTheme({});
                  setThemeAdjustments({});
                  showToast('Palette reset to system defaults', 'info');
                }}
                className="px-4 py-2 bg-gray-50 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-gray-100"
              >
                Reset Defaults
              </button>
            </div>


            {[
              {
                group: 'Core UI & Layout',
                items: [
                  { label: 'Primary (Brand)', key: 'primary' },
                  { label: 'Working Area (Amber)', key: 'secondary' },
                  { label: 'UI Background', key: 'uiBg' },
                  { label: 'App Borders', key: 'border' },
                ]
              },
              {
                group: 'Normal Notes',
                items: [
                  { label: 'Note Background', key: 'noteBg' },
                  { label: 'Note Border', key: 'noteBorder' },
                ]
              },
              {
                group: 'Follow Up Notes',
                items: [
                  { label: 'Follow Up Bg', key: 'followUp' },
                  { label: 'Follow Up Border', key: 'followUpBorder' },
                ]
              },
              {
                group: 'Typography & Charts',
                items: [
                  { label: 'Text Title', key: 'textTitle' },
                  { label: 'Text Body', key: 'textBody' },
                  { label: 'Neutral Text (Black)', key: 'textMain' },
                  { label: 'Accent (Charts)', key: 'accent' },
                ]
              }
            ].map((section) => (
              <div key={section.group} className="mb-8 last:mb-0">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <div className="h-[1px] flex-1 bg-gray-100" />
                  {section.group}
                  <div className="h-[1px] flex-1 bg-gray-100" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {section.items.map((item) => {
                    const colorValue = customTheme[item.key] || (THEMES[theme] as any)[item.key] || '#000000';
                    const adj = themeAdjustments[item.key] || (THEMES[theme] as any).adjustments?.[item.key];
                    return (
                      <div key={item.key} className="p-4 bg-gray-50/50 rounded-2xl border border-gray-100 flex flex-col gap-3 group/item hover:bg-white transition-colors relative">
                        <div className="flex justify-between items-start pt-1">
                          <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block">{item.label}</label>
                        </div>
                        <div className="flex flex-col gap-3">
                          <button
                            className="w-full h-16 rounded-xl shadow-sm border border-white cursor-pointer relative overflow-hidden group/box"
                            style={{ backgroundColor: colorValue }}
                            onClick={() => {
                              setActiveProperty(item);
                              // Initialize adjustment state from current color
                              const hex = colorValue;
                              const r = parseInt(hex.slice(1, 3), 16);
                              const g = parseInt(hex.slice(3, 5), 16);
                              const b = parseInt(hex.slice(5, 7), 16);

                              const r_f = r / 255, g_f = g / 255, b_f = b / 255;
                              const max = Math.max(r_f, g_f, b_f), min = Math.min(r_f, g_f, b_f);
                              let h = 0, s, l = (max + min) / 2;
                              if (max === min) h = s = 0;
                              else {
                                const d = max - min;
                                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                switch (max) {
                                  case r_f: h = (g_f - b_f) / d + (g_f < b_f ? 6 : 0); break;
                                  case g_f: h = (b_f - r_f) / d + 2; break;
                                  case b_f: h = (r_f - g_f) / d + 4; break;
                                }
                                h /= 6;
                              }

                              setColorAdjust({ h: (adj?.h ?? h * 360), s: (adj?.s ?? s * 100), l: (adj?.l ?? l * 100) });
                              setSelectedSearchName(adj?.base || null);
                              setInitialState({
                                hex: colorValue,
                                adj: adj ? { ...adj } : null
                              });
                              setShowColorModal(true);
                            }}
                          >
                            <div className="absolute inset-0 bg-black/0 group-hover/box:bg-black/5 flex items-center justify-center transition-all">
                              <span className="text-[10px] font-black text-white opacity-0 group-hover/box:opacity-100 uppercase tracking-widest drop-shadow-md">Tune Palette</span>
                            </div>
                          </button>

                          <div className="flex flex-col gap-1.5 px-1 py-1">
                            <span className="text-[11px] font-mono text-gray-900 font-bold uppercase tracking-tight bg-gray-100/50 self-start px-2 py-0.5 rounded-lg border border-gray-100">{colorValue}</span>
                            {adj && (
                              <div className="flex flex-col items-start gap-1">
                                {adj.base && <span className="text-[12px] font-black text-indigo-600 uppercase tracking-tight leading-none drop-shadow-sm">{adj.base}</span>}
                                <div className="flex flex-col gap-1 w-full">
                                  <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100 shadow-sm">
                                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Hue</span>
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none">{adj.h}°</span>
                                  </div>
                                  <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100 shadow-sm">
                                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Lum</span>
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none">{adj.l}%</span>
                                  </div>
                                  <div className="flex justify-between items-center bg-white px-2 py-1 rounded border border-gray-100 shadow-sm">
                                    <span className="text-[8px] font-black text-gray-300 uppercase tracking-widest">Sat</span>
                                    <span className="text-[10px] font-black text-gray-600 uppercase tracking-widest leading-none">{adj.s}%</span>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Quick Inspiration Swatches */}
            <div className="mt-8 pt-6 border-t border-gray-50">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4">Pro Palette Inspiration</h3>
              <div className="flex flex-wrap gap-2">
                {[
                  '#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#db2777', '#7c3aed', '#2563eb',
                  '#1e293b', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#e2e8f0', '#f1f5f9'
                ].map(c => (
                  <button
                    key={c}
                    onClick={() => setCustomTheme({ ...customTheme, primary: c })}
                    className="w-6 h-6 rounded-lg border border-white shadow-sm hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                    title={`Apply ${c} to Primary`}
                  />
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Idea Types & Stages - Full Width */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm col-span-1 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Layout className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              <h2 className="text-lg font-bold">Idea Types & Pipeline Stages</h2>
            </div>
            <button
              onClick={addIdeaType}
              className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all"
              style={{ color: 'var(--primary)' }}
            >
              <Plus className="w-4 h-4" /> Add Type
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ideaConfigs.map((config, typeIdx) => (
              <div key={typeIdx} className="p-5 bg-gray-50 rounded-2xl border border-gray-200 space-y-4">
                <div className="flex items-center justify-between">
                  <input
                    className="bg-transparent text-sm font-black text-gray-900 tracking-tight uppercase border-b-2 border-transparent focus:border-indigo-500 outline-none w-2/3"
                    value={config.type}
                    onChange={e => updateIdeaType(typeIdx, e.target.value)}
                    placeholder="Type Name (e.g. Books)"
                  />
                  <button
                    onClick={() => removeIdeaType(typeIdx)}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2">
                  {config.stages.map((stage, stageIdx) => (
                    <div key={stageIdx} className="flex items-center gap-2 group">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-200 group-focus-within:bg-indigo-500" />
                      <input
                        className="flex-1 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                        value={stage}
                        onChange={e => updateStage(typeIdx, stageIdx, e.target.value)}
                      />
                      <button
                        onClick={() => removeStage(typeIdx, stageIdx)}
                        className="p-1 text-gray-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {config.stages.length < 5 && (
                    <button
                      onClick={() => addStage(typeIdx)}
                      className="w-full py-1.5 border border-dashed border-gray-300 rounded-lg text-[10px] font-bold text-gray-400 hover:border-indigo-300 hover:text-indigo-500 transition-all uppercase tracking-widest mt-2"
                    >
                      + Add Stage
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Note Categories */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Tag className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-lg font-bold">Your Note Tags</h2>
          </div>
          <div className="space-y-2">
            {categories.map((cat, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm"
                  value={cat}
                  onChange={e => {
                    const next = [...categories];
                    next[i] = e.target.value;
                    setCategories(next);
                  }}
                />
                <button onClick={() => setCategories(categories.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="New Tag..."
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setCategories([...categories, newCat]); setNewCat(''); } }}
              />
              <button onClick={() => { setCategories([...categories, newCat]); setNewCat(''); }} className="bg-gray-900 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
        </section>

        {/* Personal Entities */}
        <section className="bg-white rounded-2xl border border-gray-200 p-8 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <SettingsIcon className="w-5 h-5" style={{ color: 'var(--primary)' }} />
            <h2 className="text-lg font-bold">Personal Labels</h2>
          </div>
          <p className="text-xs text-gray-400 mb-4 uppercase font-bold tracking-widest">e.g. Interfrontera, Stackable, Side Project</p>
          <div className="space-y-2">
            {personalEntities.map((ent, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="flex-1 bg-gray-50 border rounded-lg px-3 py-2 text-sm"
                  value={ent}
                  onChange={e => {
                    const next = [...personalEntities];
                    next[i] = e.target.value;
                    setPersonalEntities(next);
                  }}
                />
                <button onClick={() => setPersonalEntities(personalEntities.filter((_, idx) => idx !== i))} className="p-2 text-red-400 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            <div className="flex gap-2 pt-2">
              <input
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
                placeholder="New Label..."
                value={newEntity}
                onChange={e => setNewEntity(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { setPersonalEntities([...personalEntities, newEntity]); setNewEntity(''); } }}
              />
              <button onClick={() => { setPersonalEntities([...personalEntities, newEntity]); setNewEntity(''); }} className="bg-gray-900 text-white p-2 rounded-lg"><Plus className="w-5 h-5" /></button>
            </div>
          </div>
        </section>
        {/* Unified Color Editor Modal */}
        {showColorModal && activeProperty && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300" onClick={() => setShowColorModal(false)} />
            <div className="relative w-full max-w-4xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col max-h-[90vh]">
              <div className="p-8 border-b border-gray-100 flex items-center justify-between shrink-0 bg-white z-10">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded text-[9px] font-black uppercase tracking-widest border border-indigo-100">Live Editor</span>
                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">{activeProperty.label}</h2>
                  </div>
                  <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tune tone and library colors</p>
                </div>
                <button onClick={() => setShowColorModal(false)} className="p-3 hover:bg-gray-100 rounded-2xl transition-colors">
                  <X className="w-6 h-6 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto min-h-0">
                <div className="grid grid-cols-1 lg:grid-cols-5 h-full">
                  {/* Left: Tone Workshop */}
                  <div className="lg:col-span-2 p-8 border-r border-gray-50 bg-gray-50/30">
                    <div className="sticky top-0 space-y-8">
                      <div className="space-y-4">
                        <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                          <Sliders className="w-4 h-4 text-indigo-500" />
                          Tone Workshop
                        </h3>

                        <div className="p-6 bg-white rounded-3xl border border-gray-100 shadow-sm space-y-8">
                          {/* Preview */}
                          <div className="space-y-3">
                            <div
                              className="w-full h-24 rounded-2xl border-4 border-white shadow-inner transition-colors duration-200"
                              style={{ backgroundColor: customTheme[activeProperty.key] || (THEMES[theme] as any)[activeProperty.key] }}
                            />
                            <div className="flex justify-between items-center px-1">
                              <span className="text-xs font-mono font-bold text-gray-400 uppercase tracking-tight">
                                {customTheme[activeProperty.key] || (THEMES[theme] as any)[activeProperty.key]}
                              </span>
                              {selectedSearchName && (
                                <span className="text-[11px] font-black text-indigo-500 uppercase tracking-tight">{selectedSearchName}</span>
                              )}
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="space-y-6">
                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <span>Hue</span>
                                <span className="text-indigo-600">{Math.round(colorAdjust.h)}°</span>
                              </div>
                              <input
                                type="range" min="0" max="360"
                                value={colorAdjust.h}
                                onChange={(e) => {
                                  const newH = parseInt(e.target.value);
                                  setColorAdjust(prev => ({ ...prev, h: newH }));
                                  const h = newH / 360, s = colorAdjust.s / 100, l = colorAdjust.l / 100;
                                  let r, g, b;
                                  if (s === 0) r = g = b = l;
                                  else {
                                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                    const p = 2 * l - q;
                                    const hue2rgb = (t: number) => {
                                      if (t < 0) t += 1; if (t > 1) t -= 1;
                                      if (t < 1 / 6) return p + (q - p) * 6 * t;
                                      if (t < 1 / 2) return q;
                                      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                                      return p;
                                    };
                                    r = hue2rgb(h + 1 / 3); g = hue2rgb(h); b = hue2rgb(h - 1 / 3);
                                  }
                                  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
                                  const finalHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                                  setCustomTheme({ ...customTheme, [activeProperty.key]: finalHex });
                                  setThemeAdjustments({
                                    ...themeAdjustments,
                                    [activeProperty.key]: { base: selectedSearchName || undefined, h: Math.round(newH), l: Math.round(colorAdjust.l), s: Math.round(colorAdjust.s) }
                                  });
                                }}
                                className="w-full h-2.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 shadow-inner"
                                style={{ background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)' }}
                              />
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <span>Luminance</span>
                                <span className="text-indigo-600">{Math.round(colorAdjust.l)}%</span>
                              </div>
                              <input
                                type="range" min="0" max="100"
                                value={colorAdjust.l}
                                onChange={(e) => {
                                  const newL = parseInt(e.target.value);
                                  setColorAdjust(prev => ({ ...prev, l: newL }));
                                  const h = colorAdjust.h / 360, s = colorAdjust.s / 100, l = newL / 100;
                                  let r, g, b;
                                  if (s === 0) r = g = b = l;
                                  else {
                                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                    const p = 2 * l - q;
                                    const hue2rgb = (t: number) => {
                                      if (t < 0) t += 1; if (t > 1) t -= 1;
                                      if (t < 1 / 6) return p + (q - p) * 6 * t;
                                      if (t < 1 / 2) return q;
                                      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                                      return p;
                                    };
                                    r = hue2rgb(h + 1 / 3); g = hue2rgb(h); b = hue2rgb(h - 1 / 3);
                                  }
                                  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
                                  const finalHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                                  setCustomTheme({ ...customTheme, [activeProperty.key]: finalHex });
                                  setThemeAdjustments({
                                    ...themeAdjustments,
                                    [activeProperty.key]: { base: selectedSearchName || undefined, h: Math.round(colorAdjust.h), l: Math.round(newL), s: Math.round(colorAdjust.s) }
                                  });
                                }}
                                className="w-full h-2.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 shadow-inner"
                                style={{ background: `linear-gradient(to right, hsl(${colorAdjust.h}, ${colorAdjust.s}%, 0%), hsl(${colorAdjust.h}, ${colorAdjust.s}%, 50%), hsl(${colorAdjust.h}, ${colorAdjust.s}%, 100%))` }}
                              />
                            </div>

                            <div className="space-y-3">
                              <div className="flex justify-between items-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                <span>Saturation</span>
                                <span className="text-indigo-600">{Math.round(colorAdjust.s)}%</span>
                              </div>
                              <input
                                type="range" min="0" max="100"
                                value={colorAdjust.s}
                                onChange={(e) => {
                                  const newS = parseInt(e.target.value);
                                  setColorAdjust(prev => ({ ...prev, s: newS }));
                                  const h = colorAdjust.h / 360, s = newS / 100, l = colorAdjust.l / 100;
                                  let r, g, b;
                                  if (s === 0) r = g = b = l;
                                  else {
                                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                                    const p = 2 * l - q;
                                    const hue2rgb = (t: number) => {
                                      if (t < 0) t += 1; if (t > 1) t -= 1;
                                      if (t < 1 / 6) return p + (q - p) * 6 * t;
                                      if (t < 1 / 2) return q;
                                      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                                      return p;
                                    };
                                    r = hue2rgb(h + 1 / 3); g = hue2rgb(h); b = hue2rgb(h - 1 / 3);
                                  }
                                  const toHex = (x: number) => Math.round(x * 255).toString(16).padStart(2, '0');
                                  const finalHex = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                                  setCustomTheme({ ...customTheme, [activeProperty.key]: finalHex });
                                  setThemeAdjustments({
                                    ...themeAdjustments,
                                    [activeProperty.key]: { base: selectedSearchName || undefined, h: Math.round(colorAdjust.h), l: Math.round(colorAdjust.l), s: Math.round(newS) }
                                  });
                                }}
                                className="w-full h-2.5 bg-gray-100 rounded-lg appearance-none cursor-pointer accent-indigo-600 shadow-inner"
                                style={{ background: `linear-gradient(to right, hsl(${colorAdjust.h}, 0%, ${colorAdjust.l}%), hsl(${colorAdjust.h}, 100%, ${colorAdjust.l}%))` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Library */}
                  <div className="lg:col-span-3 p-8 flex flex-col min-h-0">
                    <div className="flex items-center justify-between mb-6 shrink-0">
                      <h3 className="text-[10px] font-black text-gray-900 uppercase tracking-widest flex items-center gap-2">
                        <Grid className="w-4 h-4 text-indigo-500" />
                        Color Library
                      </h3>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Filter colors..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-8 pr-4 py-1.5 bg-gray-50 border border-gray-100 rounded-xl text-[10px] font-bold uppercase tracking-tight focus:ring-2 focus:ring-indigo-500/10 outline-none w-48 shadow-sm"
                        />
                      </div>
                    </div>

                    <div className="flex-1 overflow-y-auto">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pb-4">
                        {CSS_COLORS.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase())).map(color => (
                          <button
                            key={color}
                            onClick={() => {
                              // Resolve color to Hex and update workshop
                              const resolver = document.createElement('div');
                              resolver.style.color = color;
                              document.body.appendChild(resolver);
                              const resolved = getComputedStyle(resolver).color;
                              document.body.removeChild(resolver);
                              if (resolved.startsWith('rgb')) {
                                const match = resolved.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                                if (match) {
                                  const r = parseInt(match[1]), g = parseInt(match[2]), b = parseInt(match[3]);
                                  const hex = "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

                                  // HSL conversion
                                  const r_f = r / 255, g_f = g / 255, b_f = b / 255;
                                  const max = Math.max(r_f, g_f, b_f), min = Math.min(r_f, g_f, b_f);
                                  let h = 0, s, l = (max + min) / 2;
                                  if (max === min) h = s = 0;
                                  else {
                                    const d = max - min;
                                    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                    switch (max) {
                                      case r_f: h = (g_f - b_f) / d + (g_f < b_f ? 6 : 0); break;
                                      case g_f: h = (b_f - r_f) / d + 2; break;
                                      case b_f: h = (r_f - g_f) / d + 4; break;
                                    }
                                    h /= 6;
                                  }

                                  const h_deg = h * 360;
                                  const s_pct = s * 100;
                                  const l_pct = l * 100;

                                  setColorAdjust({ h: h_deg, s: s_pct, l: l_pct });
                                  setSelectedSearchName(color);
                                  setCustomTheme({ ...customTheme, [activeProperty.key]: hex });
                                  setThemeAdjustments({
                                    ...themeAdjustments,
                                    [activeProperty.key]: { base: color, h: Math.round(h_deg), l: Math.round(l_pct), s: Math.round(s_pct) }
                                  });
                                }
                              }
                            }}
                            className={`flex items-center gap-3 p-2 rounded-xl border transition-all text-left group ${selectedSearchName === color ? 'border-indigo-500 bg-indigo-50/30 shadow-sm' : 'border-gray-50 hover:border-indigo-100 hover:bg-gray-50'}`}
                          >
                            <div className="w-8 h-8 rounded-lg shadow-sm border border-white shrink-0" style={{ backgroundColor: color }} />
                            <span className={`text-[10px] font-black uppercase tracking-tight truncate ${selectedSearchName === color ? 'text-indigo-600' : 'text-gray-500 group-hover:text-gray-900'}`}>{color}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-8 bg-gray-50 border-t border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      if (initialState && activeProperty) {
                        setCustomTheme({ ...customTheme, [activeProperty.key]: initialState.hex });
                        if (initialState.adj) {
                          setThemeAdjustments({ ...themeAdjustments, [activeProperty.key]: initialState.adj });
                          setColorAdjust({ h: initialState.adj.h, s: initialState.adj.s, l: initialState.adj.l });
                          setSelectedSearchName(initialState.adj.base || null);
                        } else {
                          const next = { ...themeAdjustments };
                          delete next[activeProperty.key];
                          setThemeAdjustments(next);
                          // Re-calculate HSL for the original hex
                          const resolver = document.createElement('div');
                          resolver.style.color = initialState.hex;
                          document.body.appendChild(resolver);
                          const resolved = getComputedStyle(resolver).color;
                          document.body.removeChild(resolver);
                          if (resolved.startsWith('rgb')) {
                            const match = resolved.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
                            if (match) {
                              const r = parseInt(match[1]) / 255, g = parseInt(match[2]) / 255, b = parseInt(match[3]) / 255;
                              const max = Math.max(r, g, b), min = Math.min(r, g, b);
                              let h = 0, s, l = (max + min) / 2;
                              if (max === min) h = s = 0;
                              else {
                                const d = max - min;
                                s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
                                switch (max) {
                                  case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                                  case g: h = (b - r) / d + 2; break;
                                  case b: h = (r - g) / d + 4; break;
                                }
                                h /= 6;
                              }
                              setColorAdjust({ h: h * 360, s: s * 100, l: l * 100 });
                              setSelectedSearchName(null);
                            }
                          }
                        }
                        showToast('Changes reverted to initial state', 'info');
                      }
                    }}
                    className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-400 hover:text-gray-900 hover:border-gray-300 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all shadow-sm"
                  >
                    <Undo2 className="w-4 h-4" />
                    Undo Changes
                  </button>

                  {data.currentUser?.email === 'fernando.mora.uk@gmail.com' && (
                    <button
                      onClick={() => {
                        showToast('System Preset Updated (Mock)', 'success');
                        setShowColorModal(false);
                      }}
                      className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-indigo-700 transition-all shadow-lg"
                    >
                      <Save className="w-4 h-4" />
                      Save as Master Preset
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setShowColorModal(false)}
                  className="px-8 py-3 bg-gray-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                >
                  Close Editor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Settings;
