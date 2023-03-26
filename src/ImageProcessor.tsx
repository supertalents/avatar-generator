// src/ImageProcessor.tsx
import React, { ChangeEvent, useEffect, useState } from 'react';
import axios from 'axios';
import { Alert, Button, Col, Container, Form, Image, Row } from 'react-bootstrap';
import { DropzoneRootProps, DropzoneInputProps, useDropzone } from 'react-dropzone';
import { BeatLoader } from 'react-spinners';

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

    const onDrop = (acceptedFiles: File[]) => {
        if (acceptedFiles.length > 0) {
            setSelectedFile(acceptedFiles[0]);
            setPreviewUrl(URL.createObjectURL(acceptedFiles[0]));
        }
    };

    const { getRootProps, getInputProps }: { getRootProps: () => DropzoneRootProps; getInputProps: () => DropzoneInputProps } = useDropzone({
        accept: {
            'image/jpeg': [],
            'image/png': []
          },
        maxFiles: 1,
        onDrop,
    });

    const handleSubmit = async () => {
        if (!selectedFile) {
            setErrorMessage('Please select an image file.');
            return;
        }

        try {
            setIsLoading(true);
            const base64String = await toBase64(selectedFile);
            const fileExtension = base64String.substring(base64String.indexOf('/')+1, base64String.indexOf(';'));
            const regex = new RegExp(`^data:image\/${fileExtension};base64,`);
            const base64Data = base64String.replace(regex, "");
            const seed = Math.floor(Math.random() * Number.MAX_SAFE_INTEGER);
            console.log(seed);            

            const response = await axios.post<APIResponse>(
                `${API_BASE_URL}/run`,
                {
                    input: {
                        prompt: '(RAW PHOTO), (black domino mask:2), (superhero:2), (laser eyes:5), good looking, (blue, purple, red neon background colors:0.8), (high detailed skin:1.2), (8k uhd, dslr, soft lighting, high quality, film grain, Fujifilm XT3:2)',
                        nprompt: 'face mask, covered nose, whole face mask, ugly mask, ((background colors on subject)), ((bad lighting, dim lighting)), ((nsfw)), ((covered nose)), ((face paint)), weird eyes, ugly, windows, canvas frame, cartoon, 3d, ((disfigured)), ((bad art)), ((deformed)),((extra limbs)),((close up)),((b&w, black and white)), weird colors, blurry, (((duplicate))), ((morbid)), ((mutilated)), [out of frame], extra fingers, mutated hands, ((poorly drawn hands)), ((poorly drawn face)), (((mutation))), (((deformed))), blurry, ((bad anatomy)), (((bad proportions))), ((extra limbs)), cloned face, (((disfigured))), out of frame, extra limbs, (bad anatomy), gross proportions, (malformed limbs), ((missing arms)), ((missing legs)), (((extra arms))), (((extra legs))), mutated hands, (fused fingers), (too many fingers), (((long neck))), Photoshop, video game, tiling, poorly drawn hands, poorly drawn feet, poorly drawn face, out of frame, mutation, mutated, extra limbs, extra legs, extra arms, disfigured, deformed, cross-eye, body out of frame, blurry, bad art, bad anatomy, 3d render',
                        width: '512',
                        height: '512',
                        num_inference_steps: '30',
                        low_threshold: '100',
                        high_threshold: '200',
                        guidance_scale: '10',
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
                    <h1>Image Processor</h1>
                </Col>
            </Row>
            <Row>
                <Col md={6}>
                    <div {...getRootProps()} className="dropzone">
                        <input {...getInputProps()} />
                        {previewUrl ? (
                            <Image src={previewUrl} thumbnail />
                        ) : (
                            <p>Drag and drop an image or click to select</p>
                        )}
                    </div>
                    <Button variant="primary" onClick={handleSubmit}>
                        Generate Avatar
                    </Button>
                </Col>
                <Col md={6}>
                    {isLoading ? (
                        <BeatLoader color="#00BFFF" size={80} />
                    ) : (
                        resultImageUrl && (
                            <div className="result-image">
                                <Image src={resultImageUrl} thumbnail />
                            </div>
                        )
                    )}
                </Col>
            </Row>
            {errorMessage && <Alert variant="danger">{errorMessage}</Alert>}
        </Container>
    );
};

export default ImageProcessor;
