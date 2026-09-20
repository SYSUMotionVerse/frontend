import { toShanghaiDate } from '../../domain/student/shanghaiTime'

export function registrationGradeOptions(now = new Date()) {
  const year = Number(toShanghaiDate(now).slice(0, 4))
  return Array.from({ length: Math.max(0, year - 2020 + 1) }, (_, index) => `${year - index}级`)
}

// Registration choices supplied by the study administrator.
export const registrationCollegeOptions = [
  '中国语言文学系', '历史学系',
  '哲学系', '社会学与人类学学院',
  '博雅学院（通识教育部）', '岭南学院',
  '外国语学院', '法学院（知识产权学院、中英国际海事法商学院）',
  '政治与公共事务管理学院', '管理学院',
  '马克思主义学院', '心理学系',
  '新闻传播学院', '信息管理学院',
  '艺术学院', '数学学院',
  '物理学院', '化学学院',
  '地理科学与规划学院', '生命科学学院',
  '材料科学与工程学院', '电子与信息工程学院（微电子学院）',
  '计算机学院', '国家保密学院',
  '环境科学与工程学院', '系统科学与工程学院',
  '中山医学院', '光华口腔医学院',
  '公共卫生学院', '药学院',
  '护理学院', '体育部',
  '继续教育学院', '未来生物医药学院'
]
