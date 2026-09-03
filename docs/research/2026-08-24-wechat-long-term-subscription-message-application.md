# 微信小程序训练提醒：长期订阅消息模板 ID 申请与上线要求

**调研日期：** 2026-08-24  
**适用范围：** Sport Snack 的学生训练提醒（12:00 / 18:00），目标能力为微信小程序**长期订阅消息**。  
**资料范围：** 本文只引用微信/腾讯的官方一手文档；微信公众平台中需要登录后才显示的账户专属要求，以实际后台为准。

## 结论摘要

本项目待申请的不是一个泛称的“notification key”，而是**该 AppID 私有模板库中的长期订阅消息 `template_id`**。若通过 API 从公共模板库选用，接口返回字段叫 `priTmplId`；它才是前端 `wx.requestSubscribeMessage` 和服务端发送接口使用的值。公共模板标题 ID（`tid`）只用于选用模板，`AppSecret` 则是服务器密钥，绝不能放到小程序中。[选用模板（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_addwxanewtemplate.html) [发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

训练提醒应申请**长期订阅消息**而非一次性订阅消息：用户对该模板订阅一次后，开发者可以长期下发多条消息；官方目前只将长期订阅消息开放给政务民生、医疗、交通、金融、教育等**线下公共服务**。本项目应先核对真实运营主体与服务类目，只有确属教育线下公共服务时才走**教育服务**路径，不能把研究或运动训练本身当作自动准入理由。[小程序订阅消息总览（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)

公开官方文档**没有**声明“长期订阅消息一律必须微信认证”或“一律必须非个人主体”。不能把这两项写成平台通用规则。实际是否可开通、可见哪些公共模板、提交哪些材料，取决于该 AppID 的主体和获批服务类目；公众平台后台显示的要求优先。[小程序注册与认证指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/introduction/) [小程序开放的服务类目（微信开放文档）](https://developers.weixin.qq.com/miniprogram/product/material.html)

## 2026-08-25 官方文档复核：最终判定

本节是在只读核对微信开放文档、腾讯官方接口文档，并对当前 AppID 后台做只读观察后补充的结论。后台页面中的“会员订阅（Beta）”没有被当作普通模板申请操作；没有点击“选用”、申请、删除或发布。

### 1. “长期订阅消息”与“会员订阅（Beta）”不是同一项开通能力

微信官方的订阅消息总览把两者放在不同的能力分支：

- 普通**长期订阅消息（用户通过弹窗订阅）**的原文是：“用户订阅一次后，开发者可长期下发多条消息”；并明确“目前长期性订阅消息仅向政务民生、医疗、交通、金融、教育等线下公共服务开放”。[订阅消息总览](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)
- **会员订阅：安卓/鸿蒙**属于“虚拟支付”产品。官方原文是：“一次订阅，多次扣费”，并说明“对于有订阅关系的用户，微信开放平台会新增『会员专属』长期订阅消息”。这表示会员订阅会附带一组会员专属通知，但它的核心是虚拟商品的周期扣费，不是普通长期订阅模板的替代入口。[会员订阅：安卓/鸿蒙](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/vips.html)
- 官方接口也区分模板类型：获取已有模板列表接口的 `type` 字段中，`2` 为一次性订阅、`3` 为长期订阅；发送时使用账户私有的 `priTmplId`。[获取已有模板列表](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_getwxapubnewtemplate.html)

因此，后台“会员订阅（Beta）”不是“申请教育类长期订阅消息 key”的同义词。它是虚拟支付自动续费能力及其会员专属消息的入口；即使开通，也不能据此推断普通教育长期模板已经获批。普通长期模板仍应按订阅消息公共模板/私有模板流程处理。

会员订阅的官方接入指引（腾讯文档）链接为 [会员订阅消息接入指引](https://docs.qq.com/doc/DWUNoSHNWQUREUVVQ)。本次打开该链接时页面要求登录，故本文不把其不可见正文当作准入证据；可核验的准入条件以公开的 `vips.html` 为准。

### 2. 一次性订阅不能支撑每天 12:00 与 18:00 自动发送

官方总览对弹窗式一次性订阅的定义是：“用户订阅后，开发者可不限时间地下发**一条**对应的服务消息；每条消息可单独订阅或退订”。[订阅消息总览](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)

服务端发送接口的错误码 `43101` 进一步写明：用户未订阅时，除了检查授权结果，还要“检查是否一次性订阅的次数之前已下发完”。[发送订阅消息](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

据此可以确定：一次性模板的一次授权最多消费一条消息额度；即使一次授权请求两个不同的一次性模板，也只是两个独立的一次性额度，并不会变成每天重复授权。`wx.requestSubscribeMessage` 还明确禁止在同一次调用中混用一次性模板和长期（永久）模板。[请求订阅消息](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)

所以“一次性模板 + 定时任务”不能实现用户无需再次操作的每日双时段推送。若没有长期模板，产品只能改为每天一次、用户触发后的一次提醒，或继续使用站内通知；不能把一次性模板当作长期权限使用。

### 3. 当前账号与两条能力路径的准入差异

普通长期订阅的公开总览只列出“教育等线下公共服务”范围，没有承诺所有教育相关小程序自动获批。服务类目文档要求以提交时后台材料为准，并列出：

- `教育服务 → 学历教育（学校）`：公立学校需教育行政部门审批设立证明或《事业单位法人证书》，私立学校需《民办学校办学许可证》；
- `教育服务 → 非学科类培训机构`：需四类资质之一，并明确体育类培训（篮球、游泳等）属于该类目适用范围；
- 当前账号的 `体育 → 在线健身` 类目官方定义是“提供各类型的健身运动在线学习/在线指导等服务”。

详见[小程序开放的服务类目](https://developers.weixin.qq.com/miniprogram/product/material.html)。类目不能为了模板申请而虚构，必须与实际运营主体和服务一致。

会员订阅则有一套独立且更严格的硬门槛。官方 `vips.html` 要求：已接入虚拟支付、首次发布时间不少于 90 天、完成认证备案、近 30 天日均 DAU 不低于 1000；申请开通部分还明确当前只支持企业、政府机构、事业单位、社会组织类型的普通商户及普通特约商户（不支持个人和个体工商户），并要求虚拟支付商户客服电话完成认证。申请方式是向 `wx_virtualpayment@tencent.com` 发邮件，且官方强调这是“开通会员订阅自动续费能力”，单次会员购买不需要开通会员订阅。[会员订阅：安卓/鸿蒙](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/vips.html)

普通虚拟支付本身也要求“已认证小程序”、主体为企业/事业单位/个体工商户且主体信息完备。[虚拟支付](https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment.html)

本次对当前 AppID 的只读后台观察（2026-08-25）显示：微信认证未认证、备案未备案、服务类目为“体育 → 在线健身”，且“会员订阅（Beta）”页面接口返回 `ret: 1`、`errmsg: 小程序未开通虚拟支付自动续费能力或不是虚拟类目`。这与上述官方门槛一致，说明当前不具备会员订阅自动续费路径；该错误不是普通长期订阅模板被拒的证据。

### 4. 教育类长期订阅的证据边界

可以确认的官方事实只有：教育被列入长期订阅消息面向的线下公共服务行业；教育服务类目及资质也在官方类目表中公开列出。不能从公开文档推出“学校训练研究项目必然能申请到长期模板”或“体育 → 在线健身必然可见教育长期模板”。最终以该 AppID 完成真实主体/类目审核后，公众平台“功能 → 订阅消息”实际可见的模板和审核结果为准。

如果实际运营主体确实是学校/教育组织，并且提醒属于其线下教育服务，应先按真实情况完成主体信息、认证/备案及匹配的教育类目，再检查长期模板可见性；如果实际只是在线健身/体育指导，则不要为了通知能力改报教育或医疗类目。

### 5. 最终产品方案（基于上述证据）

1. **现在不申请/不开通“会员订阅（Beta）”。** 它是收费虚拟会员自动续费产品，不是通知 key 的快捷申请；当前账号也不满足其硬门槛。
2. **首选核验普通长期订阅路径。** 由真实运营主体的管理员确认主体、认证/备案和服务类目是否能合法落到教育线下公共服务；后台出现匹配的长期模板后，再选用并保存 `priTmplId`，前端授权、后端发送仍按普通订阅消息接口实现。
3. **在长期模板获批前，微信发送保持关闭或 `mode: test`，12:00/18:00 继续使用站内通知。** 不要把当前一次性候选模板当作每日双发方案。
4. **若平台明确不给长期模板，降级为每天一次或用户触发的一次性提醒。** 当前公共库中语义最接近的“每日练习通知”（`tid=76130`）只能在用户每次有效授权后发送一条；`tid` 不是发送用的私有 `template_id`，且本文未执行选用操作。

## 概念对照：申请后应保存什么

| 名称 | 用途 | 是否可放入前端 |
| --- | --- | --- |
| `tid` | 公共模板标题 ID；用于从公共模板库选用模板。 | 不需要；后台/公众平台操作时使用。 |
| `kidList` | 选用时组合的关键词 ID 列表；必须 2–5 个关键词。 | 不需要。 |
| `sceneDesc` | 选用模板时填写的服务场景描述；最长 15 个字。 | 不需要。 |
| `priTmplId` / `template_id` | 账户私有模板 ID；授权与发送都需要它。 | 可以通过已认证的后端配置接口下发给小程序；不是密钥。 |
| `AppID` | 小程序账户唯一凭证。 | 构建配置中可见。 |
| `AppSecret` / `access_token` | 获取并调用服务端微信 API 的凭据。 | **不可以**；只能保存在服务端安全配置中。 |

字段名、2–5 个关键词、15 字场景描述和返回的 `priTmplId` 均来自官方“选用模板”接口；发送接口要求账户私有的 `template_id`。[选用模板（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_addwxanewtemplate.html) `AppSecret` 是后台 API 密钥，官方明确要求妥善保管；`access_token` 的有效期为 7200 秒。[获取接口调用凭据（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken.html)

## 开通、主体、认证和服务类目

### 1. 先确认账户主体与 AppID 所有权

申请人必须使用本项目正式 AppID 的公众平台管理员账号登录 [微信公众平台](https://mp.weixin.qq.com/)。小程序注册时需要选择主体类型并完成主体信息；官方列出的主体类型包括个人、企业、政府、媒体和其他组织。[小程序注册与认证指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/introduction/)

认证规则要按**已注册的主体类型**判断：官方说明政府、媒体、其他组织主体必须通过微信认证验证主体身份；企业主体可按需要申请；个人主体暂不支持微信认证。该规则说明如何完成账号主体资格，**不等同于**长期订阅消息的单独、统一准入条件。[小程序注册与认证指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/introduction/)

### 2. 以实际运营主体申请匹配的教育服务类目

官方声明服务类目和材料会随法规、政策和平台要求变化，且“以提交时所要求的材料为准”。因此不能提前承诺某一份材料一定足够。[小程序开放的服务类目（微信开放文档）](https://developers.weixin.qq.com/miniprogram/product/material.html)

对本项目，先由学校/研究项目负责人确认下表中的哪一种与**真正的服务提供者**一致，再按后台要求上传材料：

| 候选路径 | 仅在何种事实下适用 | 官方列出的典型材料 / 风险 |
| --- | --- | --- |
| `教育服务 → 学历教育（学校）` | 由学校自身提供面向本校学生的教育相关训练服务，且学校是小程序实际运营主体。 | 公立学校需教育行政部门审批设立证明或《事业单位法人证书》；民办学校需《民办学校办学许可证》。这是目前最接近“高校面向学生的训练研究项目”的候选路径，但仍须以后台可选类目为准。[官方类目资质表](https://developers.weixin.qq.com/miniprogram/product/material.html) |
| `教育服务 → 非学科类培训机构` | 实际主体是合规的体育培训机构，而非学校。 | 需在《民办学校办学许可证》《非学科类校外培训机构培训许可证》《文化艺术类校外培训机构审核意见书》、全国校外教育培训监管与服务综合平台备案中择一；官方将体育类培训列为适用范围。不要为了拿到模板而选择不符合实际业务的类目。[官方类目资质表](https://developers.weixin.qq.com/miniprogram/product/material.html) |
| 医疗服务类目 | 仅当服务实际属于持证医疗机构提供的医疗服务。 | 运动训练、进度提醒本身不应因涉及健康信息就冒充医疗服务；医疗类目有医疗机构许可证等专门材料要求。[官方类目资质表](https://developers.weixin.qq.com/miniprogram/product/material.html) |

**不应猜测的部分：** 公开文档没有给出“高校研究项目必然获得教育类长期订阅模板”的承诺，也没有公开一个适用于所有账户的模板审核时限或材料清单。平台后台的类目申请结果和“功能 → 订阅消息”页面可见模板，才是当前 AppID 的最终依据。

## 公众平台申请流程（可执行清单）

1. [ ] 使用正式 AppID 的管理员账号登录 [微信公众平台](https://mp.weixin.qq.com/)，在“设置 / 基本设置”核对主体、认证状态和已获批服务类目。小程序官方接入指南说明了主体注册、微信认证和服务类目的入口逻辑。[小程序注册与认证指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/introduction/)
2. [ ] 以实际运营主体申请/补充匹配的教育服务类目，并按当时后台要求上传资质。学校路径优先准备教育行政审批设立证明或《事业单位法人证书》；不要用个人、实验室成员或不相符的培训机构材料替代运营主体材料。[小程序开放的服务类目（微信开放文档）](https://developers.weixin.qq.com/miniprogram/product/material.html)
3. [ ] 在公众平台的“功能 → 订阅消息”中配置模板。官方开发指南确认：模板在公众平台手动配置；没有合适模板时，可以申请添加新模板，**审核通过后**才可使用。[小程序订阅消息开发指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)
4. [ ] 优先从当前账户可见、与教育服务类目匹配的公共模板库中选用模板。若通过服务端 API 选用，需传入标题 `tid`、2–5 个 `kidList` 关键词和不超过 15 字的 `sceneDesc`；成功后保存返回的 `priTmplId`。[选用模板（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_addwxanewtemplate.html)
5. [ ] 在选用前记录模板属于“**不限频**”还是“**限频**”。官方将长期订阅细分为两者；限频模板会按预设频次（例如每日一次）校验必填字段。因为本项目计划同一模板在一天的 12:00 和 18:00 各发送一次，若模板是“每日一次”限频，就**不能**默认满足需求，更不能伪造必填字段绕过频控；应选用适合真实服务频率的模板，或在产品规则上降为每天一次。[小程序订阅消息总览（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message-overview.html)
6. [ ] 若公共库没有可表达“每日训练提醒”的模板，申请新增模板。申请说明应如实写明：**“面向已参加学校训练研究项目的学生，在其主动订阅后，于每日 12:00 / 18:00 提醒查看当天训练进度；不用于营销；点击进入训练首页。”** 不要写“医疗诊断”“治疗提醒”，也不要承诺未实现的功能。
7. [ ] 申请时准备能让审核人复现并理解场景的材料：已认证主体/类目材料、训练首页截图、明确的授权按钮与解释文案截图、提醒点击后的训练首页截图、审核测试账号（如代码审核页面要求）。小程序代码审核在需要登录才能体验时可要求测试账号；这是代码审核规则，不应混同为模板申请的固定材料。[小程序注册与认证指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/introduction/)
8. [ ] 审核通过后，记录：模板标题、私有 `template_id`、每个字段的实际 key/类型/枚举、长期模板频率类型、后台截图或审批记录、审批日期。**不要只记录模板中文名称**，也不要把公共 `tid` 当成发送用 ID。
9. [ ] 将 `template_id` 只配置到后端环境变量/密钥管理；前端继续经现有已认证接口读取当前模板 ID。`AppSecret` 和 `access_token` 必须仅由服务器持有。[发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) [获取接口调用凭据（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken.html)
10. [ ] 使用真实 AppID 和真机完成：授权接受、拒绝、再次授权、12:00/18:00 发送、点击回流、停用订阅后发送失败、服务端审计记录的验收。

## 推荐模板字段与申请描述

### 选择原则

本项目两个时段应共用一个长期模板。选模板时，优先找可组合为下列语义的 3–4 个字段；公共模板的标题、字段标签和数据类型是平台定义的，最终必须以账户可见的实际模板为准。官方“选用模板”接口允许组合 2–5 个关键词，服务端发送要求 `data` 的键与该模板字段一一匹配。[选用模板（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_addwxanewtemplate.html) [发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

| 目标语义 | 推荐模板字段类型 | 示例值 | 选择理由与限制 |
| --- | --- | --- | --- |
| 提醒事项 | `thing01.DATA` | `今日训练提醒` | `thing` 最多 20 个字符，适合说明这不是营销或医疗诊断。 |
| 提醒时间 | `time01.DATA` 或 `date01.DATA` | `2026年8月24日 18:00` | 选择能表达时段的时间/日期字段；时间必须使用官方规定的日期、24 小时制时间格式。 |
| 今日进度 | `thing02.DATA` | `今日进度 1/3` | 不要用 `number.DATA` 写 `1/3`：该类型只允许数字（可含小数）。 |
| 未完成项目 | `thing03.DATA` | `待完成：HIIT、楼梯` | 以不暴露评分、心理量表、病情或其他健康数据为准，且控制在 `thing` 的 20 字限制内。 |
| 简短提示（可选） | `thing04.DATA` | `完成后记得打卡` | 仅在实际模板有足够字段时选用；不强行申请多余字段。 |

官方发送接口规定 `thing.DATA` 最多 20 个字符、`phrase.DATA` 最多 5 个汉字、`number.DATA` 仅能是数字（可带小数），并规定日期/时间格式。因此必须基于**实际返回的字段 key 和类型**做服务端校验，不能把上表中的 `thing01` 等示例硬编码为所有模板都存在。[订阅消息参数值限制（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

**建议的 `sceneDesc`：** `学生每日训练提醒`（15 字以内）。  
**建议的审核场景说明：** “学生在完成注册和基线问卷后主动订阅。系统仅在当天无训练或未完成三项训练时，于 12:00 或 18:00 发送一条服务提醒；消息展示提醒时间、今日进度、待完成训练，点击进入训练首页。不会用于营销，且不展示动作评分、心理量表或医疗/健康诊断信息。”

## 前端授权与服务端发送的前置条件

### 前端：必须由用户动作触发

1. 小程序先从已认证后端取得当前正式 `template_id`；模板为空时不调用微信授权接口。
2. 用户在解释页主动点击“开启微信训练提醒”后，调用 `wx.requestSubscribeMessage({ tmplIds: [templateId] })`。基础库 2.8.2 起，只有用户点击或支付回调后才能调起订阅界面；一次最多订阅 5 条，且一次调用不能混用一次性和长期模板。[请求订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html)
3. 记录该**精确模板 ID**的返回结果：`accept`（接受）、`reject`（拒绝）、`ban`（后台封禁）或 `filter`（同标题被后台过滤）。用户选择“总是保持以上选择”后，可用 `wx.getSetting({ withSubscriptions: true })` 读取已持久化的订阅设置；该查询只返回勾选过“总是保持”的订阅项。[请求订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html) [获取用户设置（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/setting/wx.getSetting.html)
4. 本仓库已有的授权界面和状态模型可继续使用；正式模板到位后，后端把 `mode` 切为 `production` 并下发真实 `template_id` 即可。拒绝授权不得阻断训练，站内通知仍是兜底。

### 服务端：发送前必须全部成立

- 使用该小程序 AppID/AppSecret 在**服务端**获取并缓存 `access_token`；不要在前端请求该接口。官方接口要求 `appid`、`secret` 和 `grant_type=client_credential`。[获取接口调用凭据（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken.html)
- 有与同一 AppID 对应的接收者 `openid`、获批的 `template_id`、用户对此模板的有效长期订阅，以及符合该模板 key/类型的 `data`。
- 通过服务端调用 `POST https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=ACCESS_TOKEN`；该接口不可由小程序、网页或 App 直接调用。必填发送字段包括 `touser`、`template_id`、`data` 和 `access_token`。[发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)
- `page` 只能跳转本小程序页面。项目建议值为 `pages/training/home?source=reminder&tracking=<opaque-uuid>&slot=18%3A00&date=YYYY-MM-DD`；客户端仍应把所有 query 当作不可信输入，向后端校验追踪 ID 后再记录回流。官方确认 `page` 仅限本小程序内页面且可带参数。[发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)
- 明确设置 `miniprogram_state`：开发验收可用 `developer`，体验版验收可用 `trial`，生产发送用 `formal`。这三个是发送 API 的合法跳转目标，**不是**绕过模板、用户订阅或账户资格的开关。[发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)

无论平台总体额度如何，仍应将每名学生、日期、时段的业务幂等控制放在后端，避免重复发送。

## 拒绝、封禁与失败处理

| 场景 | 平台信号 | 本项目应做什么 |
| --- | --- | --- |
| 用户拒绝 | 前端返回 `reject` | 保存 `rejected`；不影响训练和站内通知；只在用户主动点“重新授权”时再调用授权弹窗。[请求订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html) |
| 用户关闭总开关 | 前端错误 `20004` | 标记为未授权/不可用，展示引导而非循环弹窗。[请求订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html) |
| 模板标题被过滤 | 前端返回 `filter` | 视为本次未授权；排查同一授权请求内是否有同标题模板。本项目只请求一个长期模板，可避免该问题。[请求订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html) |
| 账号或模板被封禁 | 前端 `ban`，或服务端 `43107` | 永久失败，不自动重试；停止微信发送、保留站内提醒与审计，按公众平台站内信处理。[请求订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/subscribe-message/wx.requestSubscribeMessage.html) [发送订阅消息错误码（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) |
| 用户未订阅 | 服务端 `43101` | 标记 `unauthorized`，不重试；等待用户重新主动授权。[发送订阅消息错误码（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) |
| 模板或载荷错误 | `40037`、`47003` | 标记 `configuration_error`，不盲目重试；核对私有模板 ID、实际字段 key、类型、长度和枚举。[发送订阅消息错误码（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) |
| 内容触发敏感词 | `45168` | 停止该条发送并人工修正文案；不靠重复请求规避审核。[发送订阅消息错误码（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) |
| 同一用户并发下发 | `43108` | 按“学生 + 日期 + 时段”串行/幂等；此错误不应通过并发重试扩大通知量。[发送订阅消息错误码（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) |
| 系统暂时异常 | `-1` 或网络超时 | 可在提醒窗口内有限重试，并保留同一业务幂等键；不因重试生成第二条站内通知。[发送订阅消息错误码（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) |

如果公众平台拒绝**新增模板申请**，以后台给出的具体原因和补正要求为准。公开开发文档只确认“可申请添加新模板，审核通过后可使用”，并未公开一份对所有主体通用的拒绝原因、补件列表或审核 SLA；因此不要伪造固定的“模板审核材料清单”或承诺审核时长。[小程序订阅消息开发指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html)

## 测试号、开发/体验版与 `touristappid`

- 正式端到端验收必须使用可登录公众平台管理的**真实 AppID**、该账户的 `AppSecret`、获批的私有模板以及真实用户的订阅。发送 API 的跳转目标可设为 `developer`、`trial` 或 `formal`，因此开发版/体验版可以用于验收，但不能跳过前述前置条件。[发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html) [获取接口调用凭据（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken.html)
- 微信官方将“测试号”定位为开发测试和真机预览体验工具，但公开测试号页面未承诺它可代替正式 AppID 完成长期开通、模板审批或生产送达验收。因此测试号成功不能证明生产 AppID 可用；这是由模板、`openid` 和 `access_token` 均属于具体账户上下文得出的工程结论。[小程序测试号（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/devtools/sandbox.html) [发送订阅消息（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-message-management/subscribe-message/api_sendmessage.html)
- 公众官方文档未发现针对 `touristappid` 的订阅消息专门条款。下面的限制是由官方前置条件得出的**推论**：它不是一个可在公众平台中管理模板和 AppSecret 的正式小程序账户，因此无法获得该账户的私有模板 ID 或服务端 `access_token`，不能形成真实的长期订阅消息发送闭环。只能用于本地 UI/模拟链路，不能作为生产验收依据。[小程序订阅消息开发指南（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/framework/open-ability/subscribe-message.html) [获取接口调用凭据（微信开放文档）](https://developers.weixin.qq.com/miniprogram/dev/server/API/mp-access-token/api_getaccesstoken.html)
- 本仓库后端协议里的 `mode: 'test'` 是项目内部的测试发送模式，不是微信为该 AppID 授予的“长期订阅测试资格”。切换为 `production` 前仍须完成本文件的真实模板与真机验收清单。

## 本项目的立即行动项

1. 由 AppID 管理员确认实际主体是高校/学校、其他组织、企业还是其他类型，并确认微信认证状态。
2. 以实际主体申请或核对教育服务类目；若主张“学历教育（学校）”，先准备教育行政审批设立证明或《事业单位法人证书》。
3. 在公众平台“功能 → 订阅消息”确认能否看到教育类长期模板；优先选用字段能容纳“时间 + 进度 + 未完成项目”的公共模板。
4. 无合适模板时，使用本文的审核场景说明申请新增模板，等待审批；不要在审批前填入伪造 `template_id`。
5. 审批后将 `priTmplId` 录入**后端**的生产密钥配置，并让后端的授权配置接口返回该 ID 与 `mode: 'production'`。
6. 按“接受 / 拒绝 / 后台关闭 / 发送 / 点击回流”全链路在真实 AppID 真机验收，再开放微信发送；在此之前维持站内通知和测试发送器。
