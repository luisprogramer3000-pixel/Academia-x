-- Operaciones del Agente de Clase y de generación de imágenes
ALTER TYPE "AIOperation" ADD VALUE IF NOT EXISTS 'CLASS_AGENT';
ALTER TYPE "AIOperation" ADD VALUE IF NOT EXISTS 'IMAGE_GENERATION';
