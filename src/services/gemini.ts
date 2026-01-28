import { GoogleGenerativeAI } from '@google/generative-ai';

export interface DesignSpec {
  name: string;
  description: string;
  layout: {
    type: string;
    sections: Section[];
  };
  colorScheme: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
  };
  components: Component[];
}

interface Section {
  name: string;
  type: string;
  content: string;
  children?: Component[];
}

interface Component {
  type: string;
  name: string;
  props: Record<string, any>;
  children?: Component[];
}

export class GeminiService {
  private client: GoogleGenerativeAI;
  private model: any;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is required. Set it in .env file or environment variable.');
    }
    this.client = new GoogleGenerativeAI(apiKey);
    this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  async generateDesign(prompt: string): Promise<DesignSpec> {
    const systemPrompt = `You are an expert UI/UX designer. Generate a detailed design specification in JSON format.

The design spec should include:
1. name: Project name
2. description: Brief description
3. layout: Overall layout structure with sections
4. colorScheme: Color palette (primary, secondary, accent, background, text)
5. typography: Font choices
6. components: List of UI components with their properties

Respond ONLY with valid JSON, no markdown or explanation.`;

    const result = await this.model.generateContent([
      { text: systemPrompt },
      { text: `Create a design specification for: ${prompt}` }
    ]);

    const response = result.response.text();

    // Extract JSON from response
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse design specification from Gemini response');
    }

    return JSON.parse(jsonMatch[0]) as DesignSpec;
  }

  async analyzeImage(imagePath: string): Promise<DesignSpec> {
    const fs = await import('fs');
    const imageData = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');
    const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

    const systemPrompt = `Analyze this UI design image and extract a detailed design specification in JSON format.

Include:
1. name: Suggested project name
2. description: What this UI appears to be
3. layout: Structure and sections identified
4. colorScheme: Colors used (provide hex values)
5. typography: Font styles observed
6. components: All UI components identified with their properties

Respond ONLY with valid JSON.`;

    const result = await this.model.generateContent([
      { text: systemPrompt },
      {
        inlineData: {
          mimeType,
          data: base64Image
        }
      }
    ]);

    const response = result.response.text();
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse design from image');
    }

    return JSON.parse(jsonMatch[0]) as DesignSpec;
  }

  async refineDesign(design: DesignSpec, feedback: string): Promise<DesignSpec> {
    const prompt = `Current design specification:
${JSON.stringify(design, null, 2)}

User feedback: ${feedback}

Update the design specification based on the feedback. Respond ONLY with the updated JSON.`;

    const result = await this.model.generateContent(prompt);
    const response = result.response.text();

    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse refined design');
    }

    return JSON.parse(jsonMatch[0]) as DesignSpec;
  }
}
