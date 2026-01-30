import { COMIC_STYLES } from "./constants";

export function buildComicPrompt({
  prompt,
  style,
  characterImages = [],
  isContinuation = false,
  previousContext = "",
  isAddPage = false,
  previousPages = [],
}: {
  prompt: string;
  style?: string;
  characterImages?: string[];
  isContinuation?: boolean;
  previousContext?: string;
  isAddPage?: boolean;
  previousPages?: Array<{
    prompt: string;
  }>;
}): string {
  const styleInfo = COMIC_STYLES.find((s) => s.id === style);
  const styleDesc = styleInfo?.prompt || COMIC_STYLES[2].prompt;

  let continuationContext = "";
  if (isContinuation && previousContext) {
    continuationContext = `\nCONTINUATION CONTEXT:\nThis is a continuation of an existing story. The previous page showed: ${previousContext}\nMaintain visual consistency with the previous panels. Continue the narrative naturally.\n`;
  }

  if (isAddPage && previousPages.length > 0) {
    const storyHistory = previousPages
      .map((page, index) => `Page ${index + 1}: ${page.prompt}`)
      .join("\n");

    continuationContext = `\nSTORY CONTINUATION CONTEXT:\nThis is a continuation of an existing comic story. Here are the previous pages:\n${storyHistory}\n\nThe new page should naturally continue this story. Maintain the same characters, setting, and narrative style. Reference previous events and build upon them.\n`;
  }

  let characterSection = "";
  if (characterImages.length > 0) {
    if (characterImages.length === 1) {
      characterSection = `
CRITICAL FACE CONSISTENCY INSTRUCTIONS:
- REFERENCE CHARACTER: Use the uploaded image as EXACT reference for the protagonist's face and appearance
- FACE MATCHING: The character's face must be IDENTICAL to the reference image - same eyes, nose, mouth, hair, facial structure
- APPEARANCE PRESERVATION: Maintain exact skin tone, hair color/style, eye color, and distinctive facial features
- CHARACTER CONSISTENCY: This exact same character must appear in ALL 5 panels with the same face throughout
- STYLE APPLICATION: Apply ${style} comic art style to the body/pose/action but KEEP THE FACE EXACTLY AS IN THE REFERENCE IMAGE
- NO VARIATION: Do not alter, modify, or change the character's face in any way from the reference`;
    } else if (characterImages.length === 2) {
      characterSection = `
CRITICAL DUAL CHARACTER FACE CONSISTENCY INSTRUCTIONS:
- CHARACTER 1 REFERENCE: Use the FIRST uploaded image as EXACT reference for Character 1's face and appearance
- CHARACTER 2 REFERENCE: Use the SECOND uploaded image as EXACT reference for Character 2's face and appearance
- FACE MATCHING: Both characters' faces must be IDENTICAL to their respective reference images
- VISUAL DISTINCTION: Keep both characters clearly visually distinct with their unique faces, hair, and features
- CONSISTENT PRESENCE: Both characters must appear together in at least 4 of the 5 panels
- STYLE APPLICATION: Apply ${style} comic art style while maintaining EXACT facial features from references
- NO FACE VARIATION: Never alter or modify either character's face from their reference images`;
    }
  }

  const systemPrompt = `Professional comic book page illustration.
${continuationContext}
${characterSection}

CHARACTER CONSISTENCY RULES (HIGHEST PRIORITY):
- If reference images are provided, the characters' FACES must be 100% identical to the reference images
- Never change hair color, eye color, facial structure, or distinctive features
- Apply comic style to body/pose/action but preserve exact facial appearance
- Same character must look identical across all panels they appear in

TEXT AND LETTERING (CRITICAL - MINIMAL TEXT POLICY):
- Keep text to an ABSOLUTE MINIMUM - comic panels should be primarily visual storytelling
- Maximum 1-2 speech bubbles per panel, often zero is better
- If text appears, use only 3-5 words maximum per bubble
- Prefer silent panels with expressive artwork over dialogue
- Show don't tell - convey emotion through facial expressions and body language
- All text must be PERFECTLY CLEAR, LEGIBLE, and correctly spelled
- Use bold clean comic book lettering, large and easy to read
- Speech bubbles: crisp white fill, solid black outline, pointed tail toward speaker
- NO paragraphs, long dialogue, or excessive text in any panel
- NO blurry, warped, or unreadable text

PAGE LAYOUT:
5-panel comic page arranged as:
[Panel 1] [Panel 2] — top row, 2 equal panels
[    Panel 3      ] — middle row, 1 large cinematic hero panel
[Panel 4] [Panel 5] — bottom row, 2 equal panels
- Solid black panel borders with clean white gutters between panels
- Each panel clearly separated and distinct

ART STYLE:
${styleDesc}
${characterSection}

COMPOSITION:
- Vary camera angles across panels: close-up, medium shot, wide establishing shot
- Natural visual flow: left-to-right, top-to-bottom reading order
- Dynamic character poses with clear expressive acting
- Detailed backgrounds matching the scene and mood`;

  return `${systemPrompt}\n\nSTORY:\n${prompt}`;
}
