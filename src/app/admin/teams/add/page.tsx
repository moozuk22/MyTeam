"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { uploadImage } from "@/lib/uploadImage";
import "./page.css";

interface TeamForm {
  name: string;
  slug: string;
  emblemUrl: string | null;
  imageUrl: string | null;
  imagePublicId: string | null;
}

export default function AdminAddTeamPage() {
  const router = useRouter();
  const [formData, setFormData] = useState<TeamForm>({
    name: "",
    slug: "",
    emblemUrl: null,
    imageUrl: null,
    imagePublicId: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await uploadImage(file, "club", formData.name);
      setFormData((prev) => ({
        ...prev,
        imageUrl: result.secure_url,
        imagePublicId: result.public_id,
      }));
    } catch (error) {
      console.error("Image upload error:", error);
      setErrorMessage("Грешка при качване на изображението");
    }
  };

  const generateSlug = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .trim();
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = generateSlug(name);
    setFormData((prev) => ({
      ...prev,
      name,
      slug,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      setErrorMessage("Името на отбора е задължително");
      return;
    }

    if (!formData.slug.trim()) {
      setErrorMessage("URL адресът е задължително");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      const response = await fetch("/api/admin/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          slug: formData.slug.trim(),
          imageUrl: formData.imageUrl,
          imagePublicId: formData.imagePublicId,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Грешка при добавяне на отбор");
      }

      router.push("/admin/players");
    } catch (error) {
      console.error("Add team error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Възникна грешка");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="add-team-page">
      <div className="add-team-container">
        <div className="add-team-header">
          <h1 className="add-team-title">Добавяне на отбор</h1>
          <div className="add-team-title-line" />
          <p className="add-team-subtitle">Попълнете данните за новия отбор</p>
          <button
            className="back-btn"
            onClick={() => router.push("/admin/players")}
          >
            ← Назад към отбори
          </button>
        </div>

        <form onSubmit={handleSubmit} className="add-team-form">
          {errorMessage && (
            <div className="error-message">
              {errorMessage}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Име на отбора *
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleNameChange}
              className="form-input"
              placeholder="Въведете име на отбора"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="slug" className="form-label">
              URL адрес *
            </label>
            <input
              type="text"
              id="slug"
              name="slug"
              value={formData.slug}
              onChange={handleInputChange}
              className="form-input"
              placeholder="url-address"
              required
            />
            <small className="form-hint">
              Автоматично генериран от името на отбора
            </small>
          </div>

          <div className="form-group">
            <label htmlFor="image" className="form-label">
              Емблема на отбора
            </label>
            <div className="image-upload">
              {formData.imageUrl ? (
                <div className="image-preview">
                  <img
                    src={formData.imageUrl}
                    alt="Емблема"
                    className="preview-image"
                  />
                  <button
                    type="button"
                    className="remove-image-btn"
                    onClick={() => setFormData((prev) => ({
                      ...prev,
                      imageUrl: null,
                      imagePublicId: null,
                    }))}
                  >
                    Премахни
                  </button>
                </div>
              ) : (
                <div 
                  className="upload-area"
                  onClick={() => document.getElementById('image')?.click()}
                >
                  <input
                    type="file"
                    id="image"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="file-input"
                  />
                  <div className="upload-placeholder">
                    <div className="upload-icon">📷</div>
                    <p>Качване на емблема</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Добавяне..." : "Добави отбор"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
