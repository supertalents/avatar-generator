// src/ImageProcessor.tsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Button, Col, Container, Image, Row } from 'react-bootstrap';
import { DropzoneRootProps, DropzoneInputProps, useDropzone } from 'react-dropzone';
import { BeatLoader } from 'react-spinners';
import heic2any from 'heic2any';
import imageCompression from 'browser-image-compression';

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

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL as string;
    const API_KEY = process.env.REACT_APP_API_KEY as string;

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

                    if (response.data.status === 'COMPLETED') {
                        console.log(`response: ${JSON.stringify(response)}`);

                        if (response.data.output?.includes('image')) {
                            const resultOutputJson = JSON.parse(response.data.output)
                            const resultImage = resultOutputJson['image']
                            setResultImageUrl(`data:image/png;base64,${resultImage}`);
                            console.log(`Result image url: ${resultImageUrl}`);

                            clearInterval(interval);
                            setIsLoading(false);
                        }
                    }
                } catch (error) {
                    clearInterval(interval);
                    setErrorMessage('Error fetching status. Please try again.');
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

            let file = acceptedFiles[0]
            const isHeif = file.type === 'image/heif';
            const isHeic = file.type === 'image/heic';

            if (isHeif || isHeic) {
                const buffer = await file.arrayBuffer();
                const result = await heic2any({
                    blob: new Blob([buffer], { type: file.type }),
                    toType: 'image/jpeg'
                });
                if (Array.isArray(result)) {
                    file = new File(result, `${file.name}.jpeg`, { type: 'image/jpeg' });
                } else {
                    file = new File([result], `${file.name}.jpeg`, { type: 'image/jpeg' });
                }
            }

            // Create an object URL for the image file
            const previewUrl = URL.createObjectURL(file);

            // Create an HTMLImageElement to load the image file
            const img = document.createElement('img');

            // Wait for the image to load before cropping it
            img.onload = async () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');

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
                        croppedFile = new File(blob, `${file.name}.jpeg`, { type: 'image/jpeg' });
                    } else if (blob != null) {
                        croppedFile = new File([blob], `${file.name}.jpeg`, { type: 'image/jpeg' });
                    } else {
                        throw Error('An error occured')
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

    const { getRootProps, getInputProps }: { getRootProps: () => DropzoneRootProps; getInputProps: () => DropzoneInputProps } = useDropzone({
        accept: {
            'image/jpeg': [],
            'image/png': [],
            'image/heic': [],
            'image/heif': []
        },
        maxFiles: 1,
        onDropAccepted: async (files) => {
            const file = files[0]
            const isHeif = file.type === 'image/heif';
            const isHeic = file.type === 'image/heic';

            if (isHeif || isHeic) {
                const buffer = await file.arrayBuffer();
                const result = await heic2any({
                    blob: new Blob([buffer], { type: file.type }),
                    toType: 'image/jpeg'
                });
                if (Array.isArray(result)) {
                    return new File(result, `${file.name}.jpeg`, { type: 'image/jpeg' });
                } else {
                    return new File([result], `${file.name}.jpeg`, { type: 'image/jpeg' });
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
            useWebWorker: true
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
            setErrorMessage('Please select an image file.');
            return;
        }

        try {
            const compressedFile = await compressImage(selectedFile);
            setIsLoading(true);
            const base64String = await toBase64(compressedFile);
            console.log(base64String);

            const fileExtension = base64String.substring(base64String.indexOf('/') + 1, base64String.indexOf(';'));
            const regex = new RegExp(`^data:image\/${fileExtension};base64,`);
            const base64Data = base64String.replace(regex, "");
            const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            console.log(seed);

            const response = await axios.post<APIResponse>(
                `${API_BASE_URL}/run`,
                {
                    input: {
                        prompt: '(RAW PHOTO:2), (highly detailed hero eye mask in black:15), (laser eyes:6), (superhero:5), (hoodie:3), (scifi:1.2), (high detailed skin:3), (hyper realistic mask:2), (synthwave:0.1), (8k uhd, dslr, high quality, cinematic lighting, film grain, hyper realistic, Fujifilm XT3:4)',
                        nprompt: '(black and white:5), (negative picture:3), (cartoon:5), (illustration:5), (sculpture:3), (unnatural skin:3), (eyebrows on mask:3), (big mask:3), (weird mask:3), badly fitting mask, evil look, (covered nose:5), (hard mask:2), (whole face mask:3), ugly mask, (bad lighting:5), (light burst:5), nsfw, covered nose, (face paint:5), (weird eyes:5), (ugly:5), windows, canvas frame, cartoon, disfigured, bad art, deformed, extra limbs, close up, b&w, black and white, weird colors, blurry, duplicate, morbid, mutilated, out of frame, extra fingers, mutated hands, poorly drawn hands, poorly drawn face, mutation, deformed, blurry, bad anatomy, bad proportions, extra limbs, cloned face, disfigured, out of frame, extra limbs, bad anatomy, gross proportions, malformed limbs, missing arms, missing legs, extra arms, extra legs, mutated hands, fused fingers, too many fingers, long neck, Photoshop, video game, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, mutation, mutated, extra limbs, extra legs, extra arms, disfigured, deformed, (cross-eye:5), body out of frame, blurry, bad art, bad anatomy',
                        width: '512', 
                        height: '512',
                        num_inference_steps: '60',
                        low_threshold: '50',
                        high_threshold: '120',
                        guidance_scale: '12',
                        seed: seed,
                        image: base64Data,
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
            setErrorMessage('Error processing the image. Please try again.');
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
                <div className="button-container">
                    {resultImageUrl == null ? (
                    <Button variant="primary" onClick={handleSubmit}>
                        Generate Avatar
                    </Button>) : (
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
