import { presetWeapp } from '@furinalu/unocss-preset-weapp'
import { defineConfig, presetWind3, transformerVariantGroup } from 'unocss'

export default defineConfig({
  content: {
    filesystem: [
      'src/**/*.{html,ts,tsx,vue}',
      'src/uni-app/**/*.{html,ts,tsx,vue}'
    ]
  },
  shortcuts: {
    'card-shell': 'rounded-[32px] bg-white p-6 shadow-sm border border-[#F0E6D8]',
    'section-title': 'text-[56rpx] font-black tracking-tight text-[#1A202C]',
    'chip-soft': 'inline-flex items-center rounded-full px-6 py-2.5 text-[32rpx] font-black uppercase tracking-widest',
    
    // NEW FORMS STYLES
    'input-shell': 'w-full rounded-full bg-white border-[3px] border-[#FFEAC2] h-[58px] px-6 text-[40rpx] text-[#1A202C] font-bold focus:border-[#FFD384] focus:ring-4 focus:ring-[#FFEAC2]/50 placeholder:text-[#94A3B8] transition-all',
    'btn-primary': 'w-full h-[64px] bg-[#FF8B8B] text-white flex items-center justify-center rounded-full shadow-[0_6px_0px_#DE6E6E] active:translate-y-1 active:shadow-none transition-all font-black text-[44rpx] disabled:opacity-50 disabled:shadow-none disabled:translate-y-1',
  },
  theme: {
    colors: {
      brand: {
        coral: '#FF8B8B',
        gold: '#FFD384',
        teal: '#89CFFF',
        ink: '#1A202C',
        cream: '#FCF7F0'
      }
    }
  },
  presets: [presetWind3(), presetWeapp() as never],
  transformers: [transformerVariantGroup()]
})
