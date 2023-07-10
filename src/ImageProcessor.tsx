// src/ImageProcessor.tsx
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Alert, Button, Col, Container, Image, Row } from "react-bootstrap";
import {
  DropzoneRootProps,
  DropzoneInputProps,
  useDropzone,
} from "react-dropzone";
import { BeatLoader } from "react-spinners";
import heic2any from "heic2any";
import imageCompression from "browser-image-compression";
import {get} from 'lodash';
interface APIResponse {
  id: string;
  status: string;
  output?: string;
}

const ImageProcessor: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [resultImageUrl, setResultImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [seed, setSeed] = useState<number | null>(null);
  const [userSeed, setUserSeed] = useState<number>(-1);
  const [prompt, setPrompt] = useState(
    "RAW photo, (hero eye mask:10), (laser eyes:4), sharp focus, high-quality digital painting, photorealistic style, superhero look, cinematic lighting, well-lit face, natural skin color, art by Jim Lee, Marc Silvestri, Mike Winkelmann (Beeple), space background with neon lights (neon colors:3), vibrant colors, face and hair not affected by neon lights, modern and stylish superhero costume, realistic appearance"
  );
  const [nprompt, setNprompt] = useState(
    "ugly, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, extra limbs, disfigured, deformed, body out of frame, bad anatomy, watermark, signature, cut off, low contrast, underexposed, overexposed, bad art, beginner, amateur, distorted face, blurry, draft, grainy, weird green color on face, weird reddish color on face, glowing light on face, no mask, (no eye mask:5), (mask only covering forehead:5), dark face, face silhouette, strange eyebrows, unnatural skin colors, full face mask, blue skin, purple skin, neon lights on face, neon lights on hair"
  );
  const [showAdvanced, setShowAdvanced] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL as string;
  const API_KEY = process.env.REACT_APP_API_KEY as string;

  const handlePromptChange = (e: any) => {
    setPrompt(e?.target?.value);
  };

  const handleNpromptChange = (e: any) => {
    setNprompt(e?.target?.value);
  };

  const handleUserSeedChange = (e: any) => {
    setUserSeed(e?.target?.value);
  };

  useEffect(() => {
    if (jobId) {
      const interval = setInterval(async () => {
        try {
          const response = await axios.get<APIResponse>(
            `${API_BASE_URL}/status/${jobId}`,
            {
              headers: {
                Authorization: `Bearer ${API_KEY}`,
              },
            }
          );

          if (response.data.status === "COMPLETED" && response.data.output !== undefined) {
            console.log(`response: ${JSON.stringify(response)}`);

            const resultImage = get(response.data.output[0],"image");
            setResultImageUrl(`data:image/png;base64,${resultImage}`);
            console.log(`Result image url: ${resultImageUrl}`);

            clearInterval(interval);
            setIsLoading(false);
          }
        } catch (error) {
          clearInterval(interval);
          setErrorMessage("Error fetching status. Please try again.");
          setIsLoading(false);
        }
      }, 5000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [jobId]);

  const onDrop = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      let file = acceptedFiles[0];
      const isHeif = file.type === "image/heif";
      const isHeic = file.type === "image/heic";

      if (isHeif || isHeic) {
        const buffer = await file.arrayBuffer();
        const result = await heic2any({
          blob: new Blob([buffer], { type: file.type }),
          toType: "image/jpeg",
        });
        if (Array.isArray(result)) {
          file = new File(result, `${file.name}.jpeg`, { type: "image/jpeg" });
        } else {
          file = new File([result], `${file.name}.jpeg`, {
            type: "image/jpeg",
          });
        }
      }

      // Create an object URL for the image file
      const previewUrl = URL.createObjectURL(file);

      // Create an HTMLImageElement to load the image file
      const img = document.createElement("img");

      // Wait for the image to load before cropping it
      img.onload = async () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        // Determine the dimensions of the cropped square
        const minSize = Math.min(img.width, img.height);
        const x = (img.width - minSize) / 2;
        const y = (img.height - minSize) / 2;
        const size = minSize;

        // Set the dimensions of the canvas to the size of the cropped square
        canvas.width = size;
        canvas.height = size;

        // Draw the cropped square onto the canvas
        ctx?.drawImage(img, x, y, size, size, 0, 0, size, size);

        // Convert the canvas data to a blob
        canvas.toBlob((blob) => {
          let croppedFile;

          if (Array.isArray(blob)) {
            croppedFile = new File(blob, `${file.name}.jpeg`, {
              type: "image/jpeg",
            });
          } else if (blob != null) {
            croppedFile = new File([blob], `${file.name}.jpeg`, {
              type: "image/jpeg",
            });
          } else {
            throw Error("An error occured");
          }

          setSelectedFile(croppedFile);
          setPreviewUrl(URL.createObjectURL(croppedFile));
        }, file.type);
      };

      // Set the source of the image element to the object URL
      img.src = previewUrl;

      // setSelectedFile(file);
      // setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const {
    getRootProps,
    getInputProps,
  }: {
    getRootProps: () => DropzoneRootProps;
    getInputProps: () => DropzoneInputProps;
  } = useDropzone({
    accept: {
      "image/jpeg": [],
      "image/png": [],
      "image/heic": [],
      "image/heif": [],
    },
    maxFiles: 1,
    onDropAccepted: async (files) => {
      const file = files[0];
      const isHeif = file.type === "image/heif";
      const isHeic = file.type === "image/heic";

      if (isHeif || isHeic) {
        const buffer = await file.arrayBuffer();
        const result = await heic2any({
          blob: new Blob([buffer], { type: file.type }),
          toType: "image/jpeg",
        });
        if (Array.isArray(result)) {
          return new File(result, `${file.name}.jpeg`, { type: "image/jpeg" });
        } else {
          return new File([result], `${file.name}.jpeg`, {
            type: "image/jpeg",
          });
        }
      }

      return file;
    },
    onDrop,
  });

  async function compressImage(file: File): Promise<File> {
    const options = {
      maxSizeMB: 1.5,
      maxWidthOrHeight: 512,
      useWebWorker: true,
    };

    try {
      const compressedFile = await imageCompression(file, options);
      return compressedFile;
    } catch (error) {
      console.log(error);
      return file;
    }
  }

  const handleSubmit = async () => {
    if (!selectedFile) {
      setErrorMessage("Please select an image file.");
      return;
    }

    try {
      const compressedFile = await compressImage(selectedFile);
      setIsLoading(true);
      const base64String = await toBase64(compressedFile);
      console.log(base64String);

      const fileExtension = base64String.substring(
        base64String.indexOf("/") + 1,
        base64String.indexOf(";")
      );
      const regex = new RegExp(`^data:image\/${fileExtension};base64,`);
      const base64Data = base64String.replace(regex, "");

      let seed = 0;
      if (userSeed === -1) {
        seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
      } else {
        seed = userSeed;
      }
      setSeed(seed);

      const response = await axios.post<APIResponse>(
        `${API_BASE_URL}/run`,
        {
          input: {
            prompt: prompt,
            nprompt: nprompt,
            width: "512",
            height: "512",
            num_inference_steps: "30",
            low_threshold: "50",
            high_threshold: "150",
            guidance_scale: "10",
            seed: seed,
            image: base64Data,
            no_of_images: 4
          },
        },
        {
          headers: {
            Authorization: `Bearer ${API_KEY}`,
          },
        }
      );

      setJobId(response.data.id);
      setErrorMessage(null);
    } catch (error) {
      setErrorMessage("Error processing the image. Please try again.");
      setIsLoading(false);
    }
  };

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(file);
    });

  return (
    <Container fluid>
      <Row>
        <Col>
          <h1>SuperTalents Avatars</h1>
        </Col>
      </Row>
      <Row>
        <Col md={6}>
          <div {...getRootProps()} className="dropzone">
            <input {...getInputProps()} />
            {previewUrl ? (
              <div className="result-image">
                <Image src={previewUrl} thumbnail />
              </div>
            ) : (
              <p>Drag and drop an image or click to select</p>
            )}
          </div>
        </Col>
        <Col md={6}>
          {isLoading ? (
            <BeatLoader color="#00BFFF" size={40} />
          ) : (
            resultImageUrl && (
              <div className="result-image">
                <Image src={resultImageUrl} thumbnail />
              </div>
            )
          )}
        </Col>
      </Row>
      <Row>
        <p>Seed: {seed}</p>
      </Row>
      <Row>
        <div className="prompt-container">
          <br />
          <button
            className="advanced-config-button"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            {showAdvanced ? "Hide Advanced" : "Show Advanced"}
          </button>
          {showAdvanced && (
            <div>
              <br />
              <label htmlFor="prompt">Prompt:</label>
              <textarea
                id="prompt"
                name="prompt"
                rows={4}
                value={prompt}
                onChange={handlePromptChange}
              />
              <br />
              <label htmlFor="prompt">Negative Prompt:</label>
              <textarea
                id="nprompt"
                name="nprompt"
                rows={4}
                value={nprompt}
                onChange={handleNpromptChange}
              />
              <br />
              <label htmlFor="prompt">Seed (-1 for random):</label>
              <textarea
                id="prompt"
                name="prompt"
                rows={1}
                value={userSeed}
                onChange={handleUserSeedChange}
              />
            </div>
          )}
        </div>
      </Row>
      <Row>
        <div className="button-container">
          {resultImageUrl == null ? (
            <Button variant="primary" onClick={handleSubmit}>
              Generate Avatar
            </Button>
          ) : (
            <Button variant="primary" onClick={handleSubmit}>
              Regenerate Avatar
            </Button>
          )}
        </div>
      </Row>
      {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
    </Container>
  );
};

export default ImageProcessor;
