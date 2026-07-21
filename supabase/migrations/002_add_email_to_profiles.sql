-- Migration: Add email column to profiles table
-- Run this if you already have the initial schema deployed

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email text;
