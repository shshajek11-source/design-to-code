import { GoogleGenerativeAI } from '@google/generative-ai';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  private client: GoogleGenerativeAI | null = null;
  private model: any = null;
  private useOAuth: boolean = false;

  constructor() {
    // Try API key first, then OAuth
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.client = new GoogleGenerativeAI(apiKey);
      this.model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash' });
    } else {
      this.useOAuth = true;
    }
  }

  private async getAccessToken(): Promise<string> {
    try {
      // Use gcloud to get access token
      const { stdout } = await execAsync('gcloud auth application-default print-access-token');
      return stdout.trim();
    } catch (error) {
      throw new Error(
        'Google OAuth not configured. Run: gcloud auth application-default login\n' +
        'Or set GEMINI_API_KEY environment variable.'
      );
    }
  }

  private async callGeminiAPI(prompt: string): Promise<string> {
    if (!this.useOAuth && this.model) {
      const result = await this.model.generateContent(prompt);
      return result.response.text();
    }

    // Use OAuth with REST API
    const accessToken = await this.getAccessToken();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || await this.getProjectId();

    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gemini API error: ${error}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
  }

  private async getProjectId(): Promise<string> {
    try {
      const { stdout } = await execAsync('gcloud config get-value project');
      return stdout.trim();
    } catch {
      throw new Error('Could not determine Google Cloud project. Set GOOGLE_CLOUD_PROJECT env var.');
    }
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

Respond ONLY with valid JSON, no markdown or explanation.

Create a design specification for: ${prompt}`;

    const response = await this.callGeminiAPI(systemPrompt);

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

    if (!this.useOAuth && this.model) {
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
        { inlineData: { mimeType, data: base64Image } }
      ]);

      const response = result.response.text();
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Failed to parse design from image');
      }
      return JSON.parse(jsonMatch[0]) as DesignSpec;
    }

    // OAuth with image
    const accessToken = await this.getAccessToken();
    const projectId = process.env.GOOGLE_CLOUD_PROJECT || await this.getProjectId();

    const response = await fetch(
      `https://us-central1-aiplatform.googleapis.com/v1/projects/${projectId}/locations/us-central1/publishers/google/models/gemini-2.0-flash:generateContent`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [
              { text: 'Analyze this UI design image and extract a detailed design specification in JSON format. Include name, description, layout, colorScheme, typography, components. Respond ONLY with valid JSON.' },
              { inlineData: { mimeType, data: base64Image } }
            ]
          }],
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);
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

    const response = await this.callGeminiAPI(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse refined design');
    }

    return JSON.parse(jsonMatch[0]) as DesignSpec;
  }

  async checkAuth(): Promise<{ method: string; status: string }> {
    if (!this.useOAuth) {
      return { method: 'API Key', status: 'configured' };
    }
    try {
      await this.getAccessToken();
      return { method: 'Google OAuth', status: 'authenticated' };
    } catch {
      return { method: 'Google OAuth', status: 'not authenticated' };
    }
  }
}
