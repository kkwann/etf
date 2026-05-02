# ETF Quant Ranking Dashboard

GitHub Pages에 그대로 올릴 수 있는 정적 대시보드입니다.

## 파일 구성

- `index.html`: 메인 화면
- `style.css`: 스타일
- `app.js`: 데이터 로딩, 필터링, 상세화면 렌더링
- `data.json`: `ranking_df`, `signal_df`를 합친 대시보드 데이터
- `export_data_example.py`: pandas DataFrame을 `data.json`으로 저장하는 예시

## GitHub Pages 배포

1. 새 GitHub repository를 만듭니다.
2. 이 폴더의 파일을 repository 루트에 업로드합니다.
3. Settings → Pages → Branch를 `main`, folder를 `/root`로 설정합니다.
4. 배포 URL에서 `index.html`이 자동으로 열립니다.

## data.json 구조

```json
{
  "meta": {
    "generated_at": "2026-05-01 00:00:00",
    "signal_date": "2026-04-30"
  },
  "ranking": [
    {
      "Ticker": "QQQ",
      "final_score": 82.4,
      "momentum_block_score": 86.2,
      "ret_20d_score": 78.5
    }
  ],
  "signals": [
    {
      "Ticker": "QQQ",
      "signal_date": "2026-04-30",
      "final_decision": "BUY",
      "ret_20d": 0.042,
      "ret_20d_signal": 1
    }
  ]
}
```

`Ticker`를 기준으로 `ranking`과 `signals`가 병합됩니다.

## 주의

- `final_score`는 매수점수가 아니라 전략 적합도 점수입니다.
- 실제 매수 판단은 `final_decision`, `buy_signal`, `sell_signal`을 함께 봐야 합니다.
- 로컬 파일로 직접 열면 브라우저 보안 정책 때문에 `data.json` fetch가 실패할 수 있습니다. GitHub Pages 또는 로컬 서버에서 실행하세요.

로컬 테스트:

```bash
python -m http.server 8000
```

브라우저에서 `http://localhost:8000` 접속.
