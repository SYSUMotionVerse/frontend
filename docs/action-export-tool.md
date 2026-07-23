# 动作原始数据导出工具

动作原始数据工作台从本地视频逐帧提取人体姿态，并为每个视频生成一个 `action_export` JSON 文件。文件交给独立标注工具生成 `action_standard`；小程序只消费后者，用于显示、语音播报和动作评分。

处理在浏览器本地进行，视频和结果不会上传到后端或对象存储。

## 使用方法

```bash
pnpm dev:action-tool
```

打开 `http://127.0.0.1:4174/action-tool.html`，导入一个或多个视频。为每个视频分别填写动作名称和备注，在页头填写统一导出人，然后分析并导出 ZIP。

工具会从视频呈现帧的时间戳推断源帧率，并按该帧率处理整个视频。浏览器不支持 `requestVideoFrameCallback` 时，会回退为 30 FPS，并将该值写入 `metadata.source_fps`。

## 输出格式

每个视频导出一个 schema 0.5 JSON：

```json
{
  "schema_version": "0.5",
  "action_name": "两手攀足",
  "landmark_names": ["left_shoulder"],
  "angle_names": ["left_elbow"],
  "frames": [
    {
      "frame_index": 0,
      "time": 0,
      "landmarks_2d": [[1021.2, 404.1]],
      "landmark_visibility": [0.9999],
      "angles": [2.69]
    }
  ],
  "metadata": {
    "exported_by": "研究员",
    "exported_at": "2026-07-23T07:40:39.634Z",
    "source_video": "两手攀足.mp4",
    "source_fps": 60,
    "note": "正面拍摄"
  }
}
```

`landmark_names` 固定为 12 个关键点，`angle_names` 固定为 9 个角度。每一帧均包含这三组数组；未检测到的人体、关键点或角度用 `null` 保留，不插值、不平滑、不生成评分规则。

`metadata.exported_by` 来自页头的统一设置，`action_name` 和 `metadata.note` 来自各自视频的表单。ZIP 内的文件名由动作名称生成；重名文件会自动附加序号，避免覆盖。

## 与评分的衔接

标注工具将 `action_export` 转换为 `action_standard`。`action_standard.angle_rules` 可以保存原始权重，例如关节为 `1`、肩髋和躯干为 `2`。小程序计算分数时只对有效且启用的角度权重归一化，避免在生成标准文件时损失精度。
