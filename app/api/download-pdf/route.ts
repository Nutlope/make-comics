import { NextRequest, NextResponse } from "next/server";
import { getStoryWithPagesBySlug } from "@/lib/db-actions";
import { jsPDF } from "jspdf";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const storySlug = searchParams.get("storySlug");

    if (!storySlug) {
      return NextResponse.json(
        { error: "Story slug required" },
        { status: 400 },
      );
    }

    const result = await getStoryWithPagesBySlug(storySlug);
    if (!result) {
      return NextResponse.json({ error: "Story not found" }, { status: 404 });
    }

    const { story, pages } = result;

    const images = pages
      .map((page: any) => page.generatedImageUrl)
      .filter((url: string) => url && url !== "/placeholder.svg");

    if (images.length === 0) {
      return NextResponse.json(
        { error: "No images to download" },
        { status: 400 },
      );
    }

    // Fetch all images server-side
    const imagePromises = images.map(async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch image: ${url}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    });

    const imageBuffers = await Promise.all(imagePromises);

    // Create PDF
    const pdf = new jsPDF();

    for (let i = 0; i < imageBuffers.length; i++) {
      if (i > 0) pdf.addPage();

      const imgBuffer = imageBuffers[i];
      const imgData = `data:image/jpeg;base64,${imgBuffer.toString("base64")}`;

      // For simplicity, assume images fit the page; in production you might want to scale
      pdf.addImage(imgData, "JPEG", 10, 10, 190, 277); // A4 portrait size minus margins

      // Add "Created by Make Comics" at the bottom
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(12);
      const text = "Created by Make Comics [makecomics.io]";
      const textX = 105;
      const textY = 290;
      pdf.text(text, textX, textY, { align: "center" });
      const dimensions = pdf.getTextDimensions(text);
      pdf.link(
        textX - dimensions.w / 2,
        textY - dimensions.h / 2,
        dimensions.w,
        dimensions.h,
        { url: "https://www.makecomics.io/" },
      );
    }

    const pdfBuffer = Buffer.from(pdf.output("arraybuffer"));

    // Return PDF as response
    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${story.title}.pdf"`,
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return NextResponse.json(
      { error: "Failed to generate PDF" },
      { status: 500 },
    );
  }
}
