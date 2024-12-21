// src/pages/ProfilePage.jsx

import React, { useContext, useState } from 'react';
import tw from 'twin.macro';
import styled from 'styled-components';
import {
    Typography,
    TextField,
    Button,
    Avatar,
    Card,
    CardContent,
    IconButton,
} from '@mui/material';
import { PhotoCamera } from '@mui/icons-material';
import { AuthContext } from '../context/AuthProvider';
import api from '../utils/axiosConfig';

const ProfileContainer = tw.div`flex flex-col items-center justify-center p-8 bg-gray-100 min-h-screen`;

const ProfileCard = styled(Card)`
    ${tw`w-full max-w-4xl`}
`;

const ProfileHeader = tw.div`p-4 bg-blue-500 text-white rounded-t-lg`;

const ProfileContent = styled(CardContent)`
    ${tw`flex flex-col lg:flex-row`}
`;

const ProfileDetails = tw.div`flex-1 p-4`;

const ProfileAvatarContainer = tw.div`flex flex-col items-center p-4`;
const AvatarPreview = styled(Avatar)`
    width: 150px;
    height: 150px;
`;

const FormField = tw.div`mb-4`;

const ProfilePage = () => {
    const { auth, setAuth } = useContext(AuthContext);
    const [formData, setFormData] = useState({
        firstName: auth.user.firstName || '',
        lastName: auth.user.lastName || '',
        email: auth.user.email || '',
        school: auth.user.school || '',
        avatar: auth.user.avatar || '', // URL of the avatar
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value,
        });
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setFormData({
                ...formData,
                avatar: URL.createObjectURL(e.target.files[0]),
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setMessage('');

        try {
            const data = new FormData();
            data.append('firstName', formData.firstName);
            data.append('lastName', formData.lastName);
            data.append('school', formData.school);
            if (selectedFile) {
                data.append('avatar', selectedFile);
            }

            const response = await api.put('/users/profile', data, {
                headers: {
                    Authorization: `Bearer ${auth.token}`,
                    'Content-Type': 'multipart/form-data',
                },
            });

            // Update the auth state with the updated user data
            const updatedUser = { ...auth.user, ...response.data.user };
            setAuth({
                ...auth,
                user: updatedUser,
            });

            setMessage('Perfil actualizado exitosamente');
        } catch (err) {
            setError(err.response?.data?.message || 'Error al actualizar el perfil');
        }
    };

    return (
        <ProfileContainer>
            <ProfileCard>
                <ProfileHeader>
                    <Typography variant="h5">
                        Perfil de Usuario
                    </Typography>
                </ProfileHeader>
                <ProfileContent>
                    <ProfileAvatarContainer>
                        <AvatarPreview
                            src={formData.avatar || '/default-avatar.png'}
                            alt={`${formData.firstName} ${formData.lastName}`}
                        />
                        <input
                            accept="image/*"
                            style={{ display: 'none' }}
                            id="avatar-upload"
                            type="file"
                            onChange={handleFileChange}
                        />
                        <label htmlFor="avatar-upload">
                            <Button
                                variant="contained"
                                color="primary"
                                component="span"
                                startIcon={<PhotoCamera />}
                                sx={{ mt: 2 }}
                            >
                                Cambiar Foto
                            </Button>
                        </label>
                    </ProfileAvatarContainer>
                    <ProfileDetails>
                        {message && (
                            <Typography variant="body1" color="primary" tw="mb-4">
                                {message}
                            </Typography>
                        )}
                        {error && (
                            <Typography variant="body1" color="error" tw="mb-4">
                                {error}
                            </Typography>
                        )}
                        <form onSubmit={handleSubmit}>
                            <FormField>
                                <TextField
                                    label="Nombre"
                                    name="firstName"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                    variant="outlined"
                                    fullWidth
                                    required
                                />
                            </FormField>
                            <FormField>
                                <TextField
                                    label="Apellido"
                                    name="lastName"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                    variant="outlined"
                                    fullWidth
                                    required
                                />
                            </FormField>
                            <FormField>
                                <TextField
                                    label="Correo Electrónico"
                                    name="email"
                                    type="email"
                                    value={formData.email}
                                    variant="outlined"
                                    fullWidth
                                    required
                                    disabled
                                />
                            </FormField>
                            <FormField>
                                <TextField
                                    label="Colegio"
                                    name="school"
                                    value={formData.school}
                                    onChange={handleChange}
                                    variant="outlined"
                                    fullWidth
                                    required
                                />
                            </FormField>
                            <Button type="submit" variant="contained" color="primary" fullWidth sx={{ mt: 2 }}>
                                Actualizar Perfil
                            </Button>
                        </form>
                    </ProfileDetails>
                </ProfileContent>
            </ProfileCard>
        </ProfileContainer>
    );
};

export default ProfilePage;
