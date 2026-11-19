import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;

const SYSTEM_INSTRUCTION = `너는 공공주택 입주자 모집공고문에서 정보를 뽑는 도우미야.
아래 규칙을 반드시 지켜.
1. 공고문에 적힌 내용만 사용해. 없는 내용은 추측하거나 만들지 말고 값을 빈 문자열("")로 두고 확신도(confidence)를 "못 찾음"으로 표시해.
2. 날짜는 YYYY-MM-DD로 바꿔. 연도가 없으면 공고일의 연도를 사용해. 날짜가 확정되지 않았으면 "추후 공지"라고 써.
3. 인터넷 접수, 방문 접수, 서류심사 대상자 발표, 서류 제출, 당첨자 발표를 서로 헷갈리지 마. 비슷한 날짜가 여러 개면 확신도를 "낮음"으로 표시해.
4. 신청자격, 가점, 제출서류, 놓치기 쉬운 사항은 시민이 휴대폰에서 읽기 쉬운 쉬운 말로 각각 2~3줄(120자 이내)로 요약해. 공고문 문장을 길게 그대로 옮기지 마.
5. 놓치기 쉬운 사항에는 접수 방법 제한(예: 등기우편만 접수), 짧은 기간, 기존 예비자 불이익, 서류 제출 마감 같은 항목을 우선 넣어.
6. 항목마다 근거가 된 원문 문장(evidence)을 그대로 짧게 적어줘.
7. 아래 16개 항목의 JSON만 돌려줘: name, type, noticeDate, internetStart, internetEnd, visit, docResultDate, docSubmitStart, docSubmitEnd, winnerDate, supply, eligibility, points, documents, caution, houseNo. 각 항목은 {value, evidence, confidence} 형태야.
8. 소득·자산 금액, 가점 점수처럼 숫자가 틀리면 시민에게 피해가 가는 값은 확신이 조금이라도 부족하면 "낮음"으로 표시해.`;

const fieldSchema = {
  type: Type.OBJECT,
  properties: {
    value: { type: Type.STRING, description: '추출한 값 (없으면 빈 문자열)' },
    evidence: { type: Type.STRING, description: '공고문에서 찾은 원문 근거 문장' },
    confidence: {
      type: Type.STRING,
      enum: ['높음', '보통', '낮음', '못 찾음'],
      description: '추출 확신도',
    },
  },
  required: ['value', 'evidence', 'confidence'],
};

const extractResponseSchema = {
  type: Type.OBJECT,
  properties: {
    name: fieldSchema,
    type: fieldSchema,
    noticeDate: fieldSchema,
    internetStart: fieldSchema,
    internetEnd: fieldSchema,
    visit: fieldSchema,
    docResultDate: fieldSchema,
    docSubmitStart: fieldSchema,
    docSubmitEnd: fieldSchema,
    winnerDate: fieldSchema,
    supply: fieldSchema,
    eligibility: fieldSchema,
    points: fieldSchema,
    documents: fieldSchema,
    caution: fieldSchema,
    houseNo: fieldSchema,
  },
  required: [
    'name',
    'type',
    'noticeDate',
    'internetStart',
    'internetEnd',
    'visit',
    'docResultDate',
    'docSubmitStart',
    'docSubmitEnd',
    'winnerDate',
    'supply',
    'eligibility',
    'points',
    'documents',
    'caution',
    'houseNo',
  ],
};

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '25mb' }));

  app.post('/api/extract-notice', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: 'GEMINI_API_KEY가 설정되어 있지 않습니다. Settings > Secrets에서 확인해 주세요.',
      });
      return;
    }

    const { pdfBase64, textContent } = req.body as {
      pdfBase64?: string;
      textContent?: string;
    };

    if (!pdfBase64 && (!textContent || !textContent.trim())) {
      res.status(400).json({
        error: 'PDF 파일 또는 공고문 본문 텍스트를 입력해 주세요.',
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const parts: Array<
        { text: string } | { inlineData: { mimeType: string; data: string } }
      > = [];

      if (pdfBase64) {
        parts.push({
          inlineData: {
            mimeType: 'application/pdf',
            data: pdfBase64,
          },
        });
      }

      if (textContent && textContent.trim()) {
        parts.push({
          text: `다음 SH 공고문 내용을 분석해 지정된 JSON 양식으로 추출해 주세요:\n\n${textContent.trim()}`,
        });
      } else {
        parts.push({
          text: '첨부된 SH 공고문 PDF 내용을 분석해 지정된 JSON 양식으로 추출해 주세요.',
        });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: { parts },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: 'application/json',
          responseSchema: extractResponseSchema,
        },
      });

      const rawText = (response.text ?? '').trim();
      if (!rawText) {
        res.status(502).json({ error: 'AI 응답이 비어 있습니다.' });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({ extracted: parsed });
    } catch (err) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류';
      res.status(500).json({ error: `AI 추출 실패: ${message}` });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
