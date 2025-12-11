# 接口文档：坦克大救援排行榜接口

## 1. 获取排行榜数据  注意这里的查询排行的同时也是同步玩家的救援和军衔数据

### 接口地址
POST /tank_rescue/ranklist

### 请求参数
```json
{
  "deviceId": "uuid12334434334",
  "nickName": "玩家4396",
  "resuceMaxNumber": 123,
  "soldiers": 300
}
```

### 响应数据格式
```json
{
  "success": true,
  "top5ByRescue": [
    {
      "id": 10000,
      "deviceId": "uuid12334434334",
      "nickName": "玩家昵称",
      "resuceMaxNumber": 999,
      "soldiers": 1000000,
      "avatar": "玩家头像URL",
      "createTime": "2025-12-11T20:20:30.764"
    }
  ],
  "top5BySoldiers": [
    {
      "id": 10000,
      "deviceId": "uuid12334434334",
      "nickName": "玩家昵称",
      "resuceMaxNumber": 999,
      "soldiers": 1000000,
      "avatar": "玩家头像URL",
      "createTime": "2025-12-11T20:20:30.764"
    }
  ]
}
```