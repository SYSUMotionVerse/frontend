import { presetWeapp } from '@furinalu/unocss-preset-weapp'
import { defineConfig, presetWind3, transformerVariantGroup } from 'unocss'

export default defineConfig({
  blocklist: [/^display-name$/, /^\?$/],
  rules: [
    ['chunky-shadow', { 'box-shadow': '0 8px 0px rgba(0, 0, 0, 0.05)' }],
    ['chunky-shadow-sm', { 'box-shadow': '0 6px 0px rgba(0, 0, 0, 0.08)' }],
  ],
  shortcuts: {
    'card-shell': 'rounded-[48rpx] bg-white p-[36rpx] border-[8rpx] border-[#FFEAC2]/45 shadow-[0_12rpx_0_rgba(0,0,0,0.05)]',
    'section-title': 'text-[52rpx] font-900 tracking-[-0.03em] leading-tight text-[#1A202C]',
    'chip-soft': 'inline-flex items-center rounded-full px-[24rpx] py-[12rpx] text-[24rpx] font-900 uppercase tracking-[0.16em]',
    'bouncy-btn': 'transition-transform active:translate-y-1 active:shadow-none',

    // FORM STYLES
    'input-shell': 'w-full box-border rounded-full bg-slate-50 border-[6rpx] border-[#FFEAC2] min-h-[100rpx] px-[32rpx] text-[32rpx] text-[#1A202C] font-700 placeholder:text-[#94A3B8] transition-[border-color,box-shadow,transform] duration-150',
    'btn-primary': 'w-full min-h-[108rpx] bg-[#FF8B8B] text-white flex items-center justify-center rounded-full shadow-[0_10rpx_0_#DE6E6E] active:translate-y-1 active:shadow-[0_4rpx_0_#DE6E6E] transition-[transform,box-shadow,background-color] duration-150 font-900 text-[34rpx] disabled:opacity-50 disabled:shadow-none disabled:translate-y-1',
    'btn-secondary': 'w-full min-h-[108rpx] bg-white text-[#1A202C] flex items-center justify-center rounded-full border-[6rpx] border-[#E2E8F0] shadow-[0_8rpx_0_rgba(0,0,0,0.05)] active:translate-y-1 active:shadow-[0_4rpx_0_rgba(0,0,0,0.05)] transition-[transform,box-shadow,background-color] duration-150 font-800 text-[32rpx]',
  },
  theme: {
    colors: {
      brand: {
        coral: '#FF8B8B',
        gold: '#FFD384',
        teal: '#89CFFF',
        ink: '#1A202C',
        cream: '#FCF7F0',
        leaf: '#A8E6CF',
      }
    }
  },
  presets: [presetWind3(), presetWeapp() as never],
  transformers: [transformerVariantGroup()]
})
