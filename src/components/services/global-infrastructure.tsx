"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { motion, AnimatePresence } from "framer-motion";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Callout } from "@/components/shared/callout";
import { StatChip } from "@/components/shared/typography";
import { AWSIconTile, AWS_EXTRA_ICONS } from "@/components/aws-icons";
import { RegionsUseCase, AzUseCase } from "./infra-usecases";
import { Globe2, RotateCw, Waves, MapPin, ChevronRight, Activity, Wifi, Server, ShieldAlert, Network, Building2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/* DATA                                                                */
/* ------------------------------------------------------------------ */

type Continent =
  | "NORTH AMERICA"
  | "SOUTH AMERICA"
  | "EUROPE"
  | "MIDDLE EAST"
  | "AFRICA"
  | "ASIA PACIFIC"
  | "AUSTRALIA AND NEW ZEALAND";

interface Region {
  code: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  azs: number;
  since: number;
  continent: Continent;
}

const REGIONS: Region[] = [
  { code: "us-east-1", name: "N. VIRGINIA", city: "Ashburn, US", lat: 38.9, lon: -77.4, azs: 6, since: 2006, continent: "NORTH AMERICA" },
  { code: "us-east-2", name: "OHIO", city: "Columbus, US", lat: 40.4, lon: -82.7, azs: 3, since: 2016, continent: "NORTH AMERICA" },
  { code: "us-west-1", name: "N. CALIFORNIA", city: "San Jose, US", lat: 37.4, lon: -121.9, azs: 3, since: 2009, continent: "NORTH AMERICA" },
  { code: "us-west-2", name: "OREGON", city: "Portland, US", lat: 45.6, lon: -121.9, azs: 4, since: 2011, continent: "NORTH AMERICA" },
  { code: "ca-central-1", name: "CANADA CENTRAL", city: "Montréal, CA", lat: 45.4, lon: -75.7, azs: 3, since: 2016, continent: "NORTH AMERICA" },
  { code: "ca-west-1", name: "CALGARY", city: "Calgary, CA", lat: 51.0, lon: -114.1, azs: 3, since: 2023, continent: "NORTH AMERICA" },
  { code: "sa-east-1", name: "SÃO PAULO", city: "São Paulo, BR", lat: -23.5, lon: -46.6, azs: 3, since: 2011, continent: "SOUTH AMERICA" },
  { code: "eu-west-1", name: "IRELAND", city: "Dublin, IE", lat: 53.3, lon: -6.3, azs: 3, since: 2007, continent: "EUROPE" },
  { code: "eu-west-2", name: "LONDON", city: "London, UK", lat: 51.5, lon: -0.1, azs: 3, since: 2016, continent: "EUROPE" },
  { code: "eu-west-3", name: "PARIS", city: "Paris, FR", lat: 48.9, lon: 2.4, azs: 3, since: 2017, continent: "EUROPE" },
  { code: "eu-central-1", name: "FRANKFURT", city: "Frankfurt, DE", lat: 50.1, lon: 8.7, azs: 3, since: 2014, continent: "EUROPE" },
  { code: "eu-north-1", name: "STOCKHOLM", city: "Stockholm, SE", lat: 59.3, lon: 18.1, azs: 3, since: 2018, continent: "EUROPE" },
  { code: "eu-south-1", name: "MILAN", city: "Milan, IT", lat: 45.5, lon: 9.2, azs: 3, since: 2020, continent: "EUROPE" },
  { code: "eu-south-2", name: "SPAIN", city: "Aragón, ES", lat: 40.4, lon: -3.7, azs: 3, since: 2022, continent: "EUROPE" },
  { code: "ap-south-1", name: "MUMBAI", city: "Mumbai, IN", lat: 19.1, lon: 72.9, azs: 3, since: 2016, continent: "ASIA PACIFIC" },
  { code: "ap-south-2", name: "HYDERABAD", city: "Hyderabad, IN", lat: 17.4, lon: 78.5, azs: 3, since: 2022, continent: "ASIA PACIFIC" },
  { code: "ap-northeast-1", name: "TOKYO", city: "Tokyo, JP", lat: 35.7, lon: 139.7, azs: 4, since: 2011, continent: "ASIA PACIFIC" },
  { code: "ap-northeast-2", name: "SEOUL", city: "Seoul, KR", lat: 37.6, lon: 127.0, azs: 4, since: 2016, continent: "ASIA PACIFIC" },
  { code: "ap-northeast-3", name: "OSAKA", city: "Osaka, JP", lat: 34.7, lon: 135.5, azs: 3, since: 2021, continent: "ASIA PACIFIC" },
  { code: "ap-southeast-1", name: "SINGAPORE", city: "Singapore, SG", lat: 1.35, lon: 103.8, azs: 3, since: 2010, continent: "ASIA PACIFIC" },
  { code: "ap-southeast-2", name: "SYDNEY", city: "Sydney, AU", lat: -33.9, lon: 151.2, azs: 3, since: 2012, continent: "AUSTRALIA AND NEW ZEALAND" },
  { code: "ap-southeast-3", name: "JAKARTA", city: "Jakarta, ID", lat: -6.2, lon: 106.8, azs: 3, since: 2021, continent: "ASIA PACIFIC" },
  { code: "ap-southeast-4", name: "MELBOURNE", city: "Melbourne, AU", lat: -37.8, lon: 145.0, azs: 3, since: 2023, continent: "AUSTRALIA AND NEW ZEALAND" },
  { code: "ap-east-1", name: "HONG KONG", city: "Hong Kong, CN", lat: 22.3, lon: 114.2, azs: 3, since: 2019, continent: "ASIA PACIFIC" },
  { code: "me-south-1", name: "BAHRAIN", city: "Manama, BH", lat: 26.1, lon: 50.5, azs: 3, since: 2019, continent: "MIDDLE EAST" },
  { code: "me-central-1", name: "UAE", city: "Dubai, AE", lat: 24.5, lon: 54.4, azs: 3, since: 2022, continent: "MIDDLE EAST" },
  { code: "af-south-1", name: "CAPE TOWN", city: "Cape Town, ZA", lat: -33.9, lon: 18.4, azs: 3, since: 2020, continent: "AFRICA" },
  { code: "il-central-1", name: "ISRAEL", city: "Tel Aviv, IL", lat: 32.1, lon: 34.9, azs: 3, since: 2023, continent: "MIDDLE EAST" },
];

/** Geographic filter badges for the ALL REGIONS card — "ALL" shows every region. */
const CONTINENT_FILTERS: Array<{ id: "ALL" | Continent; label: string }> = [
  { id: "ALL", label: "ALL" },
  { id: "NORTH AMERICA", label: "NORTH AMERICA" },
  { id: "SOUTH AMERICA", label: "SOUTH AMERICA" },
  { id: "EUROPE", label: "EUROPE" },
  { id: "MIDDLE EAST", label: "MIDDLE EAST" },
  { id: "AFRICA", label: "AFRICA" },
  { id: "ASIA PACIFIC", label: "ASIA PACIFIC" },
  { id: "AUSTRALIA AND NEW ZEALAND", label: "AUSTRALIA AND NEW ZEALAND" },
];

/** Camera fly-to target when a continent badge is selected (continent centroid). */
const CONTINENT_FOCUS: Record<Continent, { lat: number; lon: number }> = {
  "NORTH AMERICA": { lat: 43, lon: -100 },
  "SOUTH AMERICA": { lat: -14, lon: -58 },
  EUROPE: { lat: 50, lon: 12 },
  "MIDDLE EAST": { lat: 26, lon: 46 },
  AFRICA: { lat: 4, lon: 20 },
  "ASIA PACIFIC": { lat: 22, lon: 106 },
  "AUSTRALIA AND NEW ZEALAND": { lat: -31, lon: 141 },
};

const ARC_PAIRS: Array<[string, string]> = [
  ["us-east-1", "eu-west-1"],
  ["us-east-1", "ap-southeast-1"],
  ["us-east-1", "sa-east-1"],
  ["us-east-1", "ap-northeast-1"],
  ["us-east-1", "me-central-1"],
  ["us-west-2", "ap-northeast-1"],
  ["us-west-2", "ap-southeast-2"],
  ["us-west-1", "ap-south-1"],
  ["eu-west-1", "ap-south-1"],
  ["eu-west-1", "eu-south-1"],
  ["eu-central-1", "af-south-1"],
  ["eu-west-2", "il-central-1"],
  ["ap-southeast-1", "ap-southeast-2"],
  ["ap-northeast-1", "ap-southeast-1"],
  ["ap-south-1", "me-south-1"],
  ["sa-east-1", "af-south-1"],
  ["ca-central-1", "eu-north-1"],
  ["ap-east-1", "ap-southeast-3"],
];

/**
 * Real major submarine cables — dense ocean waypoints hand-plotted to hug
 * coastlines and NEVER cross land (validated programmatically against the
 * same LAND_POLYS the dotted globe renders). Every waypoint sits in open
 * water; curves follow shipping-lane arcs like a real cable map.
 */
const SUBMARINE_CABLES: Array<{ name: string; pts: Array<[number, number]> }> = [
  // Trans-Atlantic
  { name: "MAREA", pts: [
    [36.7, -75.6], [38.8, -71.8], [41.2, -64.5], [43.2, -56.5], [44.8, -47.5],
    [45.3, -38.5], [45.0, -30.0], [44.6, -22.0], [44.9, -14.5], [45.0, -11.0], [44.0, -9.6],
  ] }, // Virginia Beach → Bilbao
  { name: "GRACE HOPPER", pts: [
    [40.3, -73.4], [40.0, -68.5], [40.6, -60.5], [41.8, -52.5], [43.5, -45.0], [45.5, -36.5],
    [47.2, -29.0], [48.7, -22.0], [49.6, -15.5], [50.0, -10.5], [49.9, -7.5], [49.8, -6.0],
    [49.4, -6.1], [48.7, -7.2], [47.6, -8.2], [46.4, -9.0], [45.3, -9.5], [44.6, -9.9],
  ] }, // New York → Bude → Bilbao
  // Europe ↔ Asia (via Mediterranean / Red Sea / India)
  { name: "SEA-ME-WE 5", pts: [
    [43.2, 5.1], [42.6, 6.6], [41.6, 8.4], [40.0, 9.9], [38.6, 11.2], [37.2, 11.4],
    [36.3, 13.0], [35.9, 15.2], [35.5, 17.6], [34.9, 20.5], [34.6, 23.2], [33.9, 26.3],
    [31.9, 29.8], [31.3, 31.5], [30.4, 32.35], [30.0, 32.5], [29.6, 32.72], [29.2, 32.9],
    [28.8, 33.1], [28.4, 33.35], [27.0, 34.1], [25.0, 35.8], [23.0, 37.0], [21.6, 39.0],
    [19.5, 39.0], [17.0, 39.7], [14.5, 41.5], [12.9, 42.9], [12.6, 43.5], [12.5, 45.5],
    [12.3, 48.0], [12.2, 50.5], [11.5, 53.0], [10.0, 55.5], [8.5, 58.5], [7.5, 61.5],
    [7.0, 64.5], [7.2, 67.5], [8.5, 70.0], [10.5, 71.5], [13.0, 72.0], [15.8, 72.2],
    [18.9, 72.5], [17.2, 72.4], [14.5, 72.7], [12.0, 73.3], [10.0, 74.3], [8.2, 75.8],
    [6.6, 77.5], [5.9, 79.3], [5.8, 80.4], [5.6, 83.0], [5.3, 86.0], [5.1, 89.0],
    [5.5, 92.0], [6.0, 94.6], [6.3, 96.3], [6.5, 97.4], [5.9, 97.9], [5.2, 97.95],
    [4.7, 98.35], [4.2, 98.9], [3.8, 99.3], [3.0, 100.55], [2.4, 100.7], [1.9, 101.5],
    [1.5, 102.7], [1.29, 103.95],
  ] }, // Marseille → Suez → Jeddah → Djibouti → Mumbai → Matara → Singapore
  { name: "IAX", pts: [
    [18.9, 72.5], [16.5, 72.15], [14.0, 72.05], [11.5, 72.25], [9.0, 72.6], [6.5, 72.95],
    [4.2, 73.5], [4.7, 75.4], [5.3, 77.3], [5.7, 78.9], [6.1, 79.4], [6.93, 79.5],
    [6.15, 79.55], [5.85, 79.9], [5.8, 80.2], [5.85, 81.8], [5.55, 84.5], [5.35, 87.5],
    [5.6, 90.8], [6.05, 93.9], [6.35, 96.0], [6.1, 97.3], [5.8, 97.6], [5.0, 97.9],
    [4.5, 98.3], [4.0, 98.9], [3.35, 99.4],
    [2.8, 100.2], [2.25, 100.85], [1.7, 101.85], [1.38, 103.0], [1.29, 103.95],
  ] }, // Mumbai → Malé → Colombo → Singapore
  // Asia-Pacific
  { name: "APG", pts: [
    [34.9, 139.95], [34.4, 138.5], [33.7, 136.3], [32.9, 133.9], [32.6, 131.5], [33.3, 130.7],
    [34.0, 129.95], [34.6, 129.4], [35.05, 129.3], [34.3, 127.5], [33.5, 125.5], [32.8, 123.5],
    [32.0, 122.0], [31.62, 121.85], [31.1, 121.95], [29.5, 121.8], [27.0, 121.0], [25.3, 120.0],
    [24.0, 119.4], [22.9, 117.8],
    [22.28, 114.16], [21.0, 113.4], [19.0, 112.4], [17.0, 109.5], [15.0, 109.6], [13.0, 109.4],
    [11.0, 108.6], [9.5, 106.4], [8.0, 105.2], [6.5, 104.6], [4.8, 104.5], [3.2, 104.3],
    [2.0, 104.15], [1.5, 103.9], [1.29, 103.95],
  ] }, // Chikura → Busan → Shanghai → Hong Kong → Singapore
  { name: "JUPITER", pts: [
    [34.9, 139.95], [35.6, 143.2], [37.2, 148.3], [39.2, 153.8], [41.2, 159.8], [43.2, 166.3],
    [44.6, 173.2], [45.0, -179.5], [44.4, -171.0], [43.2, -163.0], [41.5, -155.0], [39.5, -147.0],
    [37.5, -139.0], [35.8, -131.5], [34.5, -125.0], [34.0, -120.0], [33.9, -119.3], [33.8, -118.7],
  ] }, // Maruyama → Los Angeles
  { name: "FASTER", pts: [
    [34.9, 139.9], [35.9, 143.8], [37.7, 149.3], [39.8, 155.3], [41.8, 161.8], [43.7, 168.3],
    [44.9, 175.2], [45.6, -178.0], [45.9, -169.0], [46.1, -160.0], [46.2, -151.0], [45.9, -142.0],
    [45.5, -133.0], [45.3, -126.5], [45.2, -124.1],
  ] }, // Chikura → Pacific City, OR
  { name: "NCP", pts: [
    [31.62, 121.85], [32.2, 123.0], [33.0, 125.2], [33.8, 127.2], [34.3, 128.6], [35.0, 129.3],
    [34.0, 129.9], [33.3, 131.6], [33.0, 134.6], [33.5, 139.2], [34.6, 145.2], [36.4, 152.2],
    [38.4, 159.6], [40.5, 167.2], [42.5, 174.6], [43.9, -178.0], [44.6, -169.0], [45.0, -160.0],
    [45.3, -151.0], [45.3, -142.0], [45.2, -133.2], [45.2, -126.3], [45.2, -124.1],
  ] }, // Shanghai → Busan → Pacific City, OR
  { name: "SOUTHERN CROSS", pts: [
    [-33.9, 151.5], [-34.6, 153.8], [-35.8, 157.3], [-36.7, 161.0], [-37.0, 165.5], [-36.9, 170.3],
    [-36.85, 173.2], [-36.5, 172.8], [-36.2, 172.6], [-34.8, 172.9], [-33.0, 174.2], [-30.8, 176.2],
    [-27.0, 178.6], [-23.5, -179.5],
    [-20.5, -178.5], [-18.14, 178.44], [-16.5, -177.8], [-12.5, -172.0], [-8.0, -166.0], [-3.5, -160.0],
    [1.5, -154.0], [6.5, -149.0], [11.5, -145.0], [16.5, -150.5], [19.5, -154.5], [21.47, -158.16],
    [24.0, -152.5], [27.5, -147.0], [31.0, -141.5], [34.5, -136.0], [37.5, -130.5], [40.0, -126.0],
    [42.5, -124.9], [44.3, -124.3], [45.2, -124.05],
  ] }, // Sydney → Auckland → Suva → Hawaii → Oregon
  { name: "INDIGO", pts: [
    [1.29, 103.95], [1.6, 102.85], [2.0, 101.65], [2.5, 100.85], [3.1, 100.45], [3.9, 99.0],
    [4.5, 98.9], [5.0, 98.4], [5.5, 98.05], [5.95, 98.0], [6.6, 97.5], [5.5, 95.3],
    [4.0, 94.8], [2.5, 95.5], [1.0, 96.8], [-0.5, 97.5], [-2.0, 98.8],
    [-3.5, 100.2], [-5.0, 101.8], [-6.5, 102.5], [-8.0, 103.5], [-9.3, 105.5], [-9.6, 108.0],
    [-9.9, 110.5], [-10.3, 113.0], [-11.0, 115.5], [-12.5, 117.5], [-15.0, 119.3], [-18.5, 118.8],
    [-22.0, 113.1], [-26.0, 113.1], [-29.5, 113.6], [-31.95, 115.1],
  ] }, // Singapore → Malacca → west of Sumatra → Christmas I. → Perth
  // Africa
  { name: "EASSy", pts: [
    [-28.96, 31.76], [-27.0, 33.4], [-24.0, 34.8], [-21.0, 35.8], [-18.0, 36.6], [-15.0, 37.2],
    [-12.0, 37.8], [-9.0, 38.9], [-6.82, 39.29], [-4.05, 40.5], [-1.0, 42.2], [0.5, 43.7],
    [2.03, 45.6],
    [3.3, 46.7], [4.5, 47.8], [6.5, 49.3], [8.5, 50.7], [10.5, 51.4], [11.8, 51.45],
    [12.1, 50.5], [12.35, 48.5], [12.55, 46.0], [12.6, 43.5],
  ] }, // Mtunzini → Maputo → Dar es Salaam → Mombasa → Mogadishu → Djibouti
  { name: "SACS", pts: [
    [-8.84, 11.8], [-7.0, 5.5], [-5.0, -3.0], [-4.0, -12.0], [-3.6, -21.0], [-3.3, -30.0], [-3.0, -39.5],
  ] }, // Luanda → Fortaleza
  { name: "EQUIANO", pts: [
    [38.69, -9.7], [36.8, -9.5], [35.0, -8.3], [33.0, -9.2], [31.0, -9.9], [28.5, -11.3],
    [25.5, -13.5], [22.5, -16.0], [19.5, -17.1], [16.5, -17.7], [13.5, -17.6], [10.5, -15.5],
    [8.0, -14.2], [6.0, -12.3], [4.3, -8.6], [4.6, -3.5], [5.1, 3.4], [3.5, -2.0],
    [1.5, -7.0], [-0.5, -9.0], [-3.5, -9.8], [-6.5, 10.0], [-10.0, 10.5], [-13.0, 11.3],
    [-16.0, 11.5], [-19.0, 11.3], [-22.68, 14.3], [-26.0, 14.0], [-29.0, 15.0], [-31.5, 16.5],
    [-33.9, 18.1],
  ] }, // Lisbon → Lagos → Swakopmund → Cape Town
  { name: "2AFRICA", pts: [
    [49.8, -6.0], [48.7, -7.0], [47.4, -8.0], [46.2, -8.8], [45.2, -9.4], [44.0, -10.0],
    [42.8, -10.6], [41.3, -10.3], [39.8, -9.9], [38.5, -9.9], [37.2, -9.3], [36.2, -8.0],
    [35.9, -6.5], [35.9, -5.5], [36.15, -4.6], [36.4, -3.3], [36.1, -4.7], [36.0, -5.6],
    [35.8, -6.4], [34.6, -7.9], [32.6, -9.4], [30.5, -10.4], [28.0, -11.4], [25.5, -13.3],
    [22.5, -15.8], [19.5, -17.0], [16.5, -17.4], [14.67, -17.8], [12.5, -17.6], [10.0, -16.8],
    [7.5, -15.0], [5.5, -11.5], [4.2, -7.3], [4.0, -2.0], [4.8, 1.0], [5.3, 3.0],
    [3.0, -3.0], [0.5, -8.5], [-2.0, -10.0], [-5.0, 6.0], [-8.0, 7.0],
    [-11.0, 8.8], [-14.0, 9.4], [-17.0, 9.6], [-20.0, 9.9], [-23.0, 11.0], [-26.0, 12.7],
    [-29.0, 14.4], [-31.5, 16.1], [-33.9, 17.8],
  ] }, // Bude → Gibraltar → Dakar → Lagos → Cape Town
  // Baltic
  { name: "C-LION1", pts: [
    [60.15, 24.96], [59.6, 22.5], [58.8, 20.5], [58.0, 19.5], [57.2, 19.0], [56.3, 17.5],
    [55.6, 15.5], [55.0, 13.8], [54.8, 12.6], [54.4, 12.1],
  ] }, // Helsinki → Rostock
];

const R = 2;

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

/* ------------------------------------------------------------------ */
/* DOTTED WORLD MAP — coarse landmass polygons [lon, lat]              */
/* ------------------------------------------------------------------ */

const LAND_POLYS: number[][][] = [
  // NORTH AMERICA mainland
  [[-168,65.5],[-166,68.5],[-156,71],[-141,69.5],[-128,70],[-115,68.5],[-105,68],[-95,68],[-90,63],[-94,58.5],[-86,56],[-82,55],[-78.5,58.5],[-77,62],[-70,61],[-64,60],[-58,54.5],[-57,51.5],[-66,49],[-67,45],[-70,43],[-74,40.5],[-76,37],[-76,34.8],[-81,31],[-80,25.5],[-82,28],[-84,30],[-89,29.5],[-94,29.5],[-97,26],[-97.5,22],[-90.5,21],[-87,21.5],[-88.5,16],[-83.5,11],[-80,9],[-77,8],[-80,7.5],[-85,10],[-91,14],[-96,15.8],[-105,20],[-107,24],[-110,23],[-114,28],[-117,32.5],[-122,37],[-124,41],[-124,48],[-131,54],[-136,58],[-140,59.5],[-148,60.5],[-152,58],[-158,56.5],[-164,60]],
  // GREENLAND
  [[-73,78],[-60,82],[-38,83.5],[-22,82],[-20,76],[-27,70],[-40,65],[-45,60],[-53,66],[-55,71],[-58,76]],
  // SOUTH AMERICA
  [[-77,8],[-75,10.8],[-71.5,12.5],[-64,10.5],[-60,8.5],[-52,5.5],[-50,0],[-44,-2.5],[-38,-5],[-35,-8],[-39,-13],[-41,-22],[-48,-26],[-52,-32],[-56,-34.5],[-62,-39],[-65,-41],[-65,-45],[-68,-50],[-68.5,-52.5],[-74,-50],[-73.5,-44],[-73.5,-37],[-71.5,-30],[-70.5,-18],[-75.5,-14],[-79,-8],[-81.3,-6],[-81,-4.5],[-80,-2.5],[-80,1],[-78,6.5]],
  // AFRICA
  [[-6,35.5],[3,36.8],[10,37],[11,33.5],[15.5,32],[20,32.5],[25,31.8],[30,31.5],[32.5,29.9],[35,24],[37,21],[39,15.5],[43,12.5],[51.3,11.8],[48,5],[41.5,-1.5],[39,-7],[35.5,-14],[36.5,-18],[35,-22],[32.8,-26],[30,-31],[27,-33.5],[20,-34.8],[18.5,-34.3],[16.5,-29],[14.5,-22.5],[12,-18],[13.5,-12.5],[9,-1],[9.8,4],[6,4.3],[1,6.2],[-7.5,4.4],[-11.5,6.5],[-13.5,8.5],[-16,11.5],[-17.5,14.7],[-16.5,19.5],[-14.5,23],[-11,27.5],[-9.5,31],[-8.5,33.5]],
  // MADAGASCAR
  [[43.5,-12.3],[48.5,-13.3],[50.3,-15.5],[49.5,-18.5],[47.5,-24],[45,-25.5],[43.7,-22.5],[43.3,-17.5]],
  // EURASIA (Europe + Asia mainland)
  [[-9,38.7],[-9.5,43.5],[-4.5,48.3],[0,49.5],[2.5,51],[4.5,53],[8,54],[8.5,55],[10.5,57.7],[10.8,55.5],[12,54.2],[14.5,54],[18.5,54.8],[21,55.5],[23.5,56.8],[24.5,59],[26,59.6],[30,59.9],[28,60.5],[26.5,60.3],[21.5,61],[21.5,63.5],[25,65.7],[22,64.5],[19.5,63],[18.5,60.5],[17.5,61],[16.5,58.5],[14.5,56.5],[12.8,55.4],[11.3,58],[10,59],[5.5,58.5],[5,60.5],[7,63],[11,64.5],[14,67.5],[18,69.5],[25.5,71],[33,69],[34.5,66.5],[36.5,65],[40,66],[44,67],[48,68.5],[60,69.5],[68,71.5],[73,71.5],[85,74.5],[95,76],[105,77.5],[113,73.8],[128,72.5],[140,71.5],[150,70.5],[161,69],[170,67],[177,64.5],[177,66],[169.6,66.1],[170,63],[178,62],[170,60],[163,58.5],[162,56],[160,53],[156.7,50.9],[155.5,53],[156,57],[152,59],[147,59.5],[142,59],[137,57],[135,55],[138.5,54.5],[141,53],[140.5,51.5],[138,49],[135.5,45],[132,43.2],[129.5,41.5],[129.5,37],[128.5,34.8],[126.5,34.5],[126,37.5],[125,39.5],[124.5,39.8],[122.3,39.5],[121.2,38.9],[121.2,40.8],[117.8,39],[119,37.5],[120.5,36],[120.5,33.5],[121.8,31],[120,27.5],[117,23.5],[114,22.3],[110,21],[108.5,21.5],[105.8,19.8],[106.5,18],[108.8,15.5],[109,13],[106.8,10.5],[104.8,8.8],[103,10.8],[100.6,13.4],[100.9,9.5],[101.5,8],[102.5,6.5],[103.5,4.5],[103.8,1.35],[101,2.5],[100.3,3.5],[98.6,5],[98.3,8],[98.5,12],[96.8,15.8],[97.5,16.5],[94,18],[92.3,20.5],[91.8,22.3],[88.5,21.8],[86.5,20],[83,17.5],[80.3,13],[77.5,8.1],[76,10],[74.5,13],[72.8,19],[70,21],[67,24.5],[64.5,25.2],[60.5,25.3],[57.6,25.7],[56.7,27.1],[54,26.9],[51.5,27.9],[49,29.4],[48.4,30],[50.2,26.6],[51.4,24.7],[54.6,24.3],[56.1,25.9],[56.4,26.35],[57.8,23.8],[59.8,22.5],[57.5,19],[55,17],[52,15.5],[48.5,14],[45,12.8],[43.3,12.8],[41.5,18],[39.5,21],[37.5,24.5],[35,29.4],[34.8,28.9],[34.3,27.8],[33.2,28.7],[32.5,29.9],[32.8,30.7],[34.2,31.2],[35,32.8],[35.8,34.5],[36.2,35.9],[36,36.5],[33.5,36.1],[30.5,36.3],[27.5,36.8],[26.7,38.5],[26.4,39.9],[27.5,40.9],[29.1,41.2],[28,43.4],[29.5,45],[31,46.5],[33.8,44.4],[36.5,45.4],[37.8,44.7],[39.5,43.5],[41.6,42.2],[41.5,41.5],[38,41.2],[35,42],[32,41.9],[29.1,41.1],[27.5,40.7],[26.2,40.1],[24.5,40.9],[23,40.5],[23.5,40],[24,37.9],[23,36.8],[22.2,36.5],[21.5,37],[21,38.8],[21.5,38.5],[20,40],[19.5,41.5],[19,42],[17,43],[15.5,44.3],[13.8,45.6],[13,45.5],[12.5,44.8],[13.5,43.6],[14,42.5],[16,41.9],[18.5,40.1],[17.3,40.3],[16.5,38.2],[15.65,37.9],[14.2,40.8],[13.5,41.2],[12,42],[10,44],[7.5,43.7],[4.8,43.3],[3.2,41.5],[0,38.8],[-5.4,36.1],[-6.5,36.5],[-7.5,37],[-9,37]],
  // BRITISH ISLES
  [[-5.7,50],[1.3,51.2],[1.7,52.8],[0,53.5],[-1.5,55],[-3,57.5],[-5,58.5],[-6,57],[-5,55.5],[-4.5,54.5],[-3,53.5],[-4.7,52],[-5.2,51.7],[-3.5,50.7]],
  [[-6,52],[-10,51.6],[-10,53.5],[-8,55.2],[-6,55.2],[-6,53.5]],
  // ICELAND
  [[-22,63.4],[-14.5,63.8],[-13.5,65],[-15,66.3],[-21,66.1],[-24.5,65.5]],
  // JAPAN
  [[140.8,41.5],[141.5,40],[141,38.5],[140.5,36.5],[139.8,35.3],[138,34.7],[135.5,34.5],[132,34],[130.9,34.3],[133,35.5],[136,36],[137.5,37.5],[139.5,39.5],[140.3,41.2]],
  [[140.5,42.5],[143,42],[145.5,43.3],[144,44],[141.5,45.4],[140.2,43.5]],
  [[130,33.5],[131.5,31.5],[130.2,31],[129.5,32.5]],
  // TAIWAN + SRI LANKA + PHILIPPINES
  [[120,22.5],[121,21.9],[122,25],[121,25.3],[120.2,23.5]],
  [[79.8,6],[80.5,5.9],[81.9,7],[81.7,8.5],[80,9.5]],
  [[120,16],[122,14.5],[121.5,18.5],[120.5,18.5]],
  [[122,7],[126.5,6.5],[125.5,9.5],[122.5,9]],
  // INDONESIA / SE ASIA ISLANDS
  [[109,1],[110.5,-3],[114,-3.5],[116,-2.5],[116.5,0],[118,5.5],[115.5,5],[113,3],[110.5,1]],
  [[95.5,4.5],[97.5,5.2],[100,2.5],[103,-0.5],[105.5,-3],[106,-5.9],[104,-5.5],[102,-3],[100,-1],[98,1.5],[95.5,5.5]],
  [[105.5,-6.1],[110,-6.5],[114,-7.5],[114.5,-8.5],[110,-8],[105.5,-7]],
  [[119,0.5],[120.5,1.3],[123.5,0.5],[120.5,-2],[122,-4],[120.5,-5.5],[119.5,-3.5]],
  [[131,-1.5],[135,-2.5],[138,-2],[141,-3],[146,-5],[148,-8.5],[146,-8],[143,-8.5],[138,-7.5],[134,-6],[132,-4],[131,-2.5]],
  // AUSTRALIA
  [[113.5,-22],[114,-26.5],[115.5,-31.5],[115,-34],[119,-34.5],[123.5,-33.8],[129,-31.7],[134,-32.5],[138.5,-35.5],[140,-38],[144,-38.5],[145,-38],[147,-38.5],[150,-37.5],[151.3,-33.9],[153,-30],[153.5,-27.5],[153,-26],[150.5,-22.5],[146.5,-19],[145.5,-15.5],[142.5,-10.8],[141.5,-13],[139.5,-17.5],[137,-16],[135.5,-12.5],[132,-11.5],[130,-12.5],[129,-14.8],[126,-14],[122.5,-17],[119,-20],[114.5,-21.5]],
  // TASMANIA + NEW ZEALAND
  [[145,-40.8],[148,-40.8],[148,-43.3],[146,-43.5]],
  [[173,-34.5],[176.5,-37.5],[178.3,-37.7],[178.5,-38.5],[177,-39.5],[175.5,-41.3],[174.7,-41.3],[174.5,-39.5],[173,-36]],
  [[172.5,-40.5],[174,-41.5],[173,-43.5],[171,-44.5],[168,-46.5],[166.5,-46],[168,-44],[171,-41.8]],
  // CUBA + SAKHALIN + NOVAYA ZEMLYA + NEWFOUNDLAND
  [[-84.9,21.9],[-80,23.2],[-74.5,20.2],[-77.5,19.9],[-84,21.5]],
  [[142,46],[143.5,49],[142.5,54],[141.8,51],[142,48]],
  [[53,70.5],[55,71.5],[58,74],[63,76],[68,76.8],[64,75.5],[58,73],[55,71]],
  [[-59.5,47.5],[-55.5,47],[-53,46.7],[-53.5,48.5],[-56,49.5],[-58,50]],
  // ANTARCTIC PENINSULA
  [[-64,-63],[-59,-63.5],[-61,-66],[-66,-68],[-70,-70],[-73,-68],[-68,-65.5]],
];

const POLY_BOXES = LAND_POLYS.map((p) => {
  let minLon = 180, maxLon = -180, minLat = 90, maxLat = -90;
  for (const [lo, la] of p) {
    if (lo < minLon) minLon = lo;
    if (lo > maxLon) maxLon = lo;
    if (la < minLat) minLat = la;
    if (la > maxLat) maxLat = la;
  }
  return { minLon, maxLon, minLat, maxLat };
});

function inPoly(lon: number, lat: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function isLand(lon: number, lat: number): boolean {
  if (lat <= -71) return true; // antarctic ring
  for (let k = 0; k < LAND_POLYS.length; k++) {
    const b = POLY_BOXES[k];
    if (lon < b.minLon || lon > b.maxLon || lat < b.minLat || lat > b.maxLat) continue;
    if (inPoly(lon, lat, LAND_POLYS[k])) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* 3D SUB-COMPONENTS                                                   */
/* ------------------------------------------------------------------ */

/** Dotted world map: bright dots = continents, faint dots = ocean grid. */
function DottedGlobe() {
  const { land, ocean } = useMemo(() => {
    const N = 16000;
    const golden = Math.PI * (3 - Math.sqrt(5));
    const landArr: number[] = [];
    const oceanArr: number[] = [];
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2;
      const rad = Math.sqrt(1 - y * y);
      const theta = golden * i;
      const x = Math.cos(theta) * rad;
      const z = Math.sin(theta) * rad;
      const px = x * R, py = y * R, pz = z * R;
      // inverse of latLonToVec3
      const lat = (Math.asin(y) * 180) / Math.PI;
      let lon = (Math.atan2(z, -x) * 180) / Math.PI - 180;
      if (lon < -180) lon += 360;
      if (isLand(lon, lat)) {
        landArr.push(px, py, pz);
      } else {
        oceanArr.push(px, py, pz);
      }
    }
    return {
      land: new Float32Array(landArr),
      ocean: new Float32Array(oceanArr),
    };
  }, []);

  return (
    <group>
      {/* continents */}
      <points raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[land, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.021} color="#ff9900" transparent opacity={0.9} sizeAttenuation />
      </points>
      {/* ocean grid — barely there */}
      <points raycast={() => null}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[ocean, 3]} />
        </bufferGeometry>
        <pointsMaterial size={0.007} color="#ffb347" transparent opacity={0.09} sizeAttenuation />
      </points>
    </group>
  );
}

/** Lat/lon graticule — map cartography feel. */
function Graticule() {
  const geom = useMemo(() => {
    const pts: number[] = [];
    const seg = 96;
    for (let lat = -60; lat <= 60; lat += 30) {
      for (let i = 0; i < seg; i++) {
        const a = latLonToVec3(lat, -180 + (360 * i) / seg, R + 0.003);
        const b = latLonToVec3(lat, -180 + (360 * (i + 1)) / seg, R + 0.003);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    for (let lon = -180; lon < 180; lon += 30) {
      for (let i = 0; i < seg; i++) {
        const a = latLonToVec3(-84 + (168 * i) / seg, lon, R + 0.003);
        const b = latLonToVec3(-84 + (168 * (i + 1)) / seg, lon, R + 0.003);
        pts.push(a.x, a.y, a.z, b.x, b.y, b.z);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
    return g;
  }, []);
  return (
    <lineSegments geometry={geom} raycast={() => null}>
      <lineBasicMaterial color="#ff9900" transparent opacity={0.06} />
    </lineSegments>
  );
}

function Stars() {
  const matRef = useRef<THREE.PointsMaterial>(null);
  const positions = useMemo(() => {
    const N = 500;
    const arr = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(14 + Math.random() * 10);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    }
    return arr;
  }, []);
  useFrame(({ clock }) => {
    if (matRef.current) {
      matRef.current.opacity = 0.3 + 0.12 * Math.sin(clock.elapsedTime * 0.9);
    }
  });
  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} size={0.05} color="#ffb347" transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

function Atmosphere() {
  const shader = useMemo(
    () => ({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
          gl_FragColor = vec4(1.0, 0.6, 0.05, 1.0) * intensity;
        }
      `,
    }),
    []
  );
  return (
    <group>
      <mesh raycast={() => null}>
        <sphereGeometry args={[R * 1.18, 48, 48]} />
        <shaderMaterial
          vertexShader={shader.vertexShader}
          fragmentShader={shader.fragmentShader}
          blending={THREE.AdditiveBlending}
          side={THREE.BackSide}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function RegionMarker({
  region,
  selected,
  hideBeam,
  onSelect,
}: {
  region: Region;
  selected: boolean;
  hideBeam: boolean;
  onSelect: (r: Region) => void;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const orbitRef = useRef<THREE.Group>(null);
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);
  const pos = useMemo(() => latLonToVec3(region.lat, region.lon, R + 0.015), [region]);
  const phase = useMemo(() => Math.random() * Math.PI * 2, []);
  const upQuat = useMemo(
    () => new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), pos.clone().normalize()),
    [pos]
  );

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    // expanding ping ring (loop: grow + fade)
    if (ringRef.current && ringMatRef.current) {
      const f = (t * 0.4 + phase) % 1;
      ringRef.current.scale.setScalar(1 + f * 2.2);
      ringMatRef.current.opacity = 0.75 * (1 - f);
    }
    // orbiting AZ satellites
    if (orbitRef.current) orbitRef.current.rotation.y = t * 0.55 + phase;
    if (groupRef.current) {
      const target = selected ? 1.9 : hovered ? 1.6 : 1;
      groupRef.current.scale.lerp(new THREE.Vector3(target, target, target), 0.14);
    }
  });

  const color = selected ? "#ff2d78" : hovered ? "#ffb347" : "#ff9900";

  return (
    <group ref={groupRef} position={pos}>
      {/* core dot */}
      <mesh
        onClick={(e) => {
          e.stopPropagation();
          onSelect(region);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = "auto";
        }}
      >
        <sphereGeometry args={[0.036, 12, 12]} />
        <meshBasicMaterial color={color} />
      </mesh>
      {/* expanding ping ring */}
      <Billboard>
        <mesh ref={ringRef}>
          <ringGeometry args={[0.05, 0.062, 32]} />
          <meshBasicMaterial
            ref={ringMatRef}
            color={selected ? "#ff2d78" : "#ff9900"}
            transparent
            opacity={0.7}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </Billboard>
      {/* tangent-plane frame: orbiting AZ satellites + uplink beam */}
      <group quaternion={upQuat}>
        <group ref={orbitRef}>
          {Array.from({ length: Math.min(region.azs, 4) }).map((_, i) => {
            const a = (i / Math.min(region.azs, 4)) * Math.PI * 2;
            return (
              <mesh key={i} position={[Math.cos(a) * 0.095, 0.015, Math.sin(a) * 0.095]}>
                <sphereGeometry args={[0.011, 8, 8]} />
                <meshBasicMaterial color="#ffb347" transparent opacity={0.9} />
              </mesh>
            );
          })}
        </group>
        {selected && !hideBeam && (
          <mesh position={[0, 0.28, 0]} raycast={() => null}>
            <cylinderGeometry args={[0.011, 0.011, 0.55, 8]} />
            <meshBasicMaterial
              color="#ff2d78"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}
      </group>
      {hovered && (
        <Html center distanceFactor={7} zIndexRange={[20, 0]}>
          <div className="px-2 py-1 bg-black/90 border border-aws/60 text-aws text-[10px] font-bold tracking-[0.15em] whitespace-nowrap backdrop-blur-sm">
            {region.code.toUpperCase()}
          </div>
        </Html>
      )}
    </group>
  );
}

interface ArcData {
  a: string;
  b: string;
  curve: THREE.QuadraticBezierCurve3;
  tubeGeo: THREE.TubeGeometry;
  tubeMat: THREE.MeshBasicMaterial;
  speed: number;
  offset: number;
}

function Arcs({ regionsById, selectedCode }: { regionsById: Map<string, Region>; selectedCode: string }) {
  const mainRefs = useRef<(THREE.Mesh | null)[]>([]);
  const trail1Refs = useRef<(THREE.Mesh | null)[]>([]);
  const trail2Refs = useRef<(THREE.Mesh | null)[]>([]);

  const arcs = useMemo<ArcData[]>(() => {
    return ARC_PAIRS.map(([a, b], i) => {
      const ra = regionsById.get(a);
      const rb = regionsById.get(b);
      if (!ra || !rb) return null;
      const start = latLonToVec3(ra.lat, ra.lon, R + 0.01);
      const end = latLonToVec3(rb.lat, rb.lon, R + 0.01);
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize()
        .multiplyScalar(R + start.distanceTo(end) * 0.38);
      const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
      const tubeGeo = new THREE.TubeGeometry(curve, 48, 0.0065, 5, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0xff9900,
        transparent: true,
        opacity: 0.24,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return { a, b, curve, tubeGeo, tubeMat, speed: 0.22 + (i % 5) * 0.05, offset: (i * 0.618) % 1 };
    }).filter(Boolean) as ArcData[];
  }, [regionsById]);

  // highlight arcs connected to the selected region
  useEffect(() => {
    arcs.forEach((arc) => {
      const connected = arc.a === selectedCode || arc.b === selectedCode;
      arc.tubeMat.color.set(connected ? "#ff2d78" : "#ff9900");
      arc.tubeMat.opacity = connected ? 0.6 : 0.22;
    });
  }, [arcs, selectedCode]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    arcs.forEach((arc, i) => {
      const p = (t * arc.speed + arc.offset) % 1;
      const p1 = (p - 0.018 + 1) % 1;
      const p2 = (p - 0.036 + 1) % 1;
      const main = mainRefs.current[i];
      const tr1 = trail1Refs.current[i];
      const tr2 = trail2Refs.current[i];
      if (main) main.position.copy(arc.curve.getPoint(p));
      if (tr1) tr1.position.copy(arc.curve.getPoint(p1));
      if (tr2) tr2.position.copy(arc.curve.getPoint(p2));
    });
  });

  useEffect(() => {
    return () =>
      arcs.forEach((arc) => {
        arc.tubeMat.dispose();
        arc.tubeGeo.dispose();
      });
  }, [arcs]);

  return (
    <group>
      {arcs.map((arc, i) => (
        <React.Fragment key={i}>
          <mesh raycast={() => null} material={arc.tubeMat} geometry={arc.tubeGeo} />
          <mesh ref={(el) => { mainRefs.current[i] = el; }}>
            <sphereGeometry args={[0.026, 8, 8]} />
            <meshBasicMaterial color="#ffb347" />
          </mesh>
          <mesh raycast={() => null} ref={(el) => { trail1Refs.current[i] = el; }}>
            <sphereGeometry args={[0.017, 6, 6]} />
            <meshBasicMaterial color="#ff9900" transparent opacity={0.55} />
          </mesh>
          <mesh raycast={() => null} ref={(el) => { trail2Refs.current[i] = el; }}>
            <sphereGeometry args={[0.011, 6, 6]} />
            <meshBasicMaterial color="#ff9900" transparent opacity={0.28} />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  );
}

interface CableData {
  name: string;
  curve: THREE.CatmullRomCurve3;
  tubeGeo: THREE.TubeGeometry;
  tubeMat: THREE.MeshBasicMaterial;
  speed: number;
  offset: number;
}

/** Real submarine cable routes — thin mint tubes hugging the sphere + travelling data pulses. */
function UnderseaCables() {
  const pulseRefs = useRef<(THREE.Mesh | null)[]>([]);

  const cables = useMemo<CableData[]>(() => {
    return SUBMARINE_CABLES.map((c, i) => {
      const raw = c.pts.map(([lat, lon]) => latLonToVec3(lat, lon, R + 0.006));
      const rough = new THREE.CatmullRomCurve3(raw, false, "catmullrom", 0.4);
      // re-sample + re-project onto the sphere so cables hug the surface (no fly-over arcs)
      const projected = rough.getPoints(220).map((v) => v.clone().normalize().multiplyScalar(R + 0.006));
      const curve = new THREE.CatmullRomCurve3(projected);
      const tubeGeo = new THREE.TubeGeometry(curve, 260, 0.0046, 4, false);
      const tubeMat = new THREE.MeshBasicMaterial({
        color: 0x00ffa3,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      return { name: c.name, curve, tubeGeo, tubeMat, speed: 0.055 + (i % 4) * 0.016, offset: (i * 0.382) % 1 };
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    cables.forEach((c, i) => {
      const p = (t * c.speed + c.offset) % 1;
      const m = pulseRefs.current[i];
      if (m) m.position.copy(c.curve.getPoint(p));
    });
  });

  useEffect(() => {
    return () =>
      cables.forEach((c) => {
        c.tubeMat.dispose();
        c.tubeGeo.dispose();
      });
  }, [cables]);

  return (
    <group>
      {cables.map((c, i) => (
        <React.Fragment key={i}>
          <mesh raycast={() => null} material={c.tubeMat} geometry={c.tubeGeo} />
          <mesh ref={(el) => { pulseRefs.current[i] = el; }}>
            <sphereGeometry args={[0.017, 6, 6]} />
            <meshBasicMaterial color="#baffdf" />
          </mesh>
        </React.Fragment>
      ))}
    </group>
  );
}

/** CloudFront edge PoPs — seeded random points, land only. */
function EdgePoPs() {
  const positions = useMemo(() => {
    const st = { s: 42 };
    const rand = () => {
      st.s = (st.s * 16807) % 2147483647;
      return st.s / 2147483647;
    };
    const arr: number[] = [];
    let attempts = 0;
    while (arr.length / 3 < 150 && attempts < 6000) {
      attempts++;
      const lat = -58 + rand() * 124;
      const lon = -180 + rand() * 360;
      if (!isLand(lon, lat)) continue;
      const v = latLonToVec3(lat, lon, R + 0.045);
      arr.push(v.x, v.y, v.z);
    }
    return new Float32Array(arr);
  }, []);
  return (
    <points raycast={() => null}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.019} color="#ffffff" transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

/**
 * Smoothly flies the camera so the focused lat/lon faces the user.
 * Any manual drag takes over and cancels the auto-focus until the next selection.
 */
function FocusRig({ focus }: { focus: { lat: number; lon: number } | null }) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    update: () => void;
    addEventListener: (type: string, fn: () => void) => void;
    removeEventListener: (type: string, fn: () => void) => void;
  } | null;
  const dirRef = useRef<THREE.Vector3 | null>(null);
  const userTookOver = useRef(false);

  useEffect(() => {
    dirRef.current = focus ? latLonToVec3(focus.lat, focus.lon, 1).normalize() : null;
    userTookOver.current = false;
  }, [focus]);

  useEffect(() => {
    if (!controls) return;
    const onStart = () => {
      userTookOver.current = true;
    };
    controls.addEventListener("start", onStart);
    return () => controls.removeEventListener("start", onStart);
  }, [controls]);

  useFrame((_, delta) => {
    const dir = dirRef.current;
    if (!dir || userTookOver.current) return;
    // Exponential, frame-rate-independent smoothing…
    const k = 1 - Math.exp(-3.2 * delta);
    // …but interpolate on the SPHERE (normalize the direction) so the chord
    // never cuts inside — the camera keeps its distance while swinging around.
    const radius = camera.position.length();
    const newDir = camera.position.clone().divideScalar(radius).lerp(dir, k).normalize();
    camera.position.copy(newDir.multiplyScalar(radius));
    if (controls) controls.update();
  });

  return null;
}

function GlobeScene({
  selectedCode,
  onSelect,
  showArcs,
  showCables,
  autoRotate,
  focus,
}: {
  selectedCode: string;
  onSelect: (r: Region) => void;
  showArcs: boolean;
  showCables: boolean;
  autoRotate: boolean;
  focus: { lat: number; lon: number } | null;
}) {
  const regionsById = useMemo(() => new Map(REGIONS.map((r) => [r.code, r])), []);

  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[5, 5, 5]} intensity={40} color="#ff9900" />
      {/* occluder core */}
      <mesh raycast={() => null}>
        <sphereGeometry args={[R - 0.02, 48, 48]} />
        <meshBasicMaterial color="#08080e" />
      </mesh>
      <Graticule />
      <DottedGlobe />
      <Stars />
      <Atmosphere />
      {showArcs && <Arcs regionsById={regionsById} selectedCode={selectedCode} />}
      {showCables && <UnderseaCables />}
      <EdgePoPs />
      <FocusRig focus={focus} />
      {REGIONS.map((r) => (
        <RegionMarker
          key={r.code}
          region={r}
          selected={r.code === selectedCode}
          hideBeam={showCables}
          onSelect={onSelect}
        />
      ))}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        minDistance={3.2}
        maxDistance={9}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* RUNTIME TELEMETRY (live details)                                    */
/* ------------------------------------------------------------------ */

function useTelemetry() {
  const [tele, setTele] = useState({ rps: 842317, gbps: 14.2, vms: 1832409, edges: 601 });
  useEffect(() => {
    const t = setInterval(() => {
      setTele((p) => ({
        rps: Math.max(700000, p.rps + Math.round((Math.random() - 0.48) * 26000)),
        gbps: Math.max(8, +(p.gbps + (Math.random() - 0.5) * 0.9).toFixed(1)),
        vms: Math.max(1500000, p.vms + Math.round((Math.random() - 0.46) * 4200)),
        edges: Math.random() < 0.05 ? p.edges + 1 : p.edges,
      }));
    }, 1000);
    return () => clearInterval(t);
  }, []);
  return tele;
}

/* ------------------------------------------------------------------ */
/* MAIN PANEL                                                          */
/* ------------------------------------------------------------------ */

const MODULE_TABS = [
  { id: "GENERAL", label: "GENERAL", num: "01", icon: Globe2 },
  { id: "REGIONS", label: "REGIONS BEST USE CASE", num: "02", icon: Network },
  { id: "AZ", label: "AVAILABILITY ZONE USE CASE", num: "03", icon: Building2 },
] as const;

type ModuleTabId = (typeof MODULE_TABS)[number]["id"];

export default function GlobalInfrastructure() {
  const [selected, setSelected] = useState<Region>(REGIONS[0]);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showArcs, setShowArcs] = useState(true);
  const [showCables, setShowCables] = useState(false);
  const [cont, setCont] = useState<"ALL" | Continent>("ALL");
  const [focus, setFocus] = useState<{ lat: number; lon: number } | null>(null);
  const [tab, setTab] = useState<ModuleTabId>("GENERAL");
  const [latency, setLatency] = useState(12);
  const [pkts, setPkts] = useState(1284);
  const tele = useTelemetry();

  /** Any region selection stops auto-rotate and flies the camera to face it. */
  const selectRegion = (r: Region) => {
    setSelected(r);
    setAutoRotate(false);
    setFocus({ lat: r.lat, lon: r.lon });
  };

  /** Continent badge: stop auto-rotate, face the continent, keep panels coherent. */
  const selectCont = (id: "ALL" | Continent) => {
    setCont(id);
    if (id === "ALL") {
      setFocus(null);
      return;
    }
    setAutoRotate(false);
    setFocus(CONTINENT_FOCUS[id]);
    const first = REGIONS.find((r) => r.continent === id);
    if (first && selected.continent !== id) setSelected(first);
  };

  const toggleAutoRotate = () => {
    if (autoRotate) {
      setAutoRotate(false);
    } else {
      setAutoRotate(true);
      setFocus(null); // rotation and camera fly-to would fight each other
    }
  };

  const latencyBase = useMemo(() => Math.round(8 + Math.abs(selected.lat) * 1.1), [selected.lat]);

  // live ping
  useEffect(() => {
    const timer = setInterval(() => {
      setLatency(latencyBase + Math.round(Math.random() * 22));
    }, 1100);
    return () => clearInterval(timer);
  }, [latencyBase]);

  // packets/sec HUD ticker
  useEffect(() => {
    const t = setInterval(() => {
      setPkts((v) => Math.max(400, Math.round(v + (Math.random() - 0.48) * 240)));
    }, 800);
    return () => clearInterval(t);
  }, []);

  // continent badge filter — "ALL" keeps the full registry visible
  const filteredRegions = useMemo(
    () => (cont === "ALL" ? REGIONS : REGIONS.filter((r) => r.continent === cont)),
    [cont]
  );

  const toggleBtn = (on: boolean, accent: "aws" | "magenta" | "mint" = "aws") =>
    `flex items-center gap-1.5 px-2 py-1.5 text-[8px] font-bold uppercase tracking-[0.2em] border backdrop-blur-md bg-black/60 transition-colors ${
      on
        ? accent === "magenta"
          ? "border-magenta/70 text-magenta shadow-[0_0_14px_rgba(255,45,120,0.4)]"
          : accent === "mint"
            ? "border-mint/70 text-mint shadow-[0_0_14px_rgba(0,255,163,0.35)]"
            : "border-aws/60 text-aws"
        : "border-foreground/20 text-muted-foreground"
    }`;

  // AZ detail rows — deterministic base per region + live wobble driven by the ping ticker
  const azRows = useMemo(() => {
    return Array.from({ length: selected.azs }, (_, i) => {
      const letter = String.fromCharCode(97 + i);
      const h = (selected.code.charCodeAt(i % selected.code.length) * 37 + i * 61) % 100;
      const base = 34 + h * 0.55;
      const wobble = ((latency * (i + 3)) % 11) - 5;
      const load = Math.min(97, Math.max(21, Math.round(base + wobble)));
      return { id: `${selected.code}${letter}`, load, hot: load > 72 };
    });
  }, [selected, latency]);

  return (
    <div className="flex flex-col gap-4">
      {/* MODULE TABS — sits directly below the module title card */}
      <div role="tablist" aria-label="Global infrastructure views" className="flex flex-wrap gap-1.5">
        {MODULE_TABS.map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-3 py-2 text-[8px] font-bold uppercase tracking-[0.18em] border backdrop-blur-md transition-colors ${
                active
                  ? "border-aws/70 bg-aws/15 text-aws shadow-[0_0_16px_rgba(255,153,0,0.28)]"
                  : "border-foreground/15 bg-black/50 text-muted-foreground hover:border-aws/40 hover:text-aws"
              }`}
            >
              <Icon className="w-3 h-3" aria-hidden="true" />
              <span className={`tabular-nums ${active ? "text-aws/70" : "text-muted-foreground/50"}`}>{t.num}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "GENERAL" && (
        <>
      {/* static stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatChip label="REGIONS ONLINE" value="28 / 34" />
        <StatChip label="AZs TRACKED" value="90" tone="magenta" delay={0.05} />
        <StatChip label="EDGE PoPs" value="600+" delay={0.1} />
        <StatChip label="COUNTRIES SERVED" value="245" tone="mint" delay={0.15} />
      </div>

      {/* live telemetry — runtime details */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { icon: Activity, label: "REQUESTS / SEC", value: tele.rps.toLocaleString("en-US"), tone: "text-aws" },
          { icon: Wifi, label: "DATA OUT", value: `${tele.gbps.toFixed(1)} GB/s`, tone: "text-mint" },
          { icon: Server, label: "ACTIVE VMS", value: tele.vms.toLocaleString("en-US"), tone: "text-neon" },
          { icon: ShieldAlert, label: "EDGE LOCATIONS", value: tele.edges.toLocaleString("en-US"), tone: "text-magenta" },
        ].map((c, i) => (
          <div key={c.label} className="glass-inset px-3 py-2 flex items-center gap-2.5">
            <c.icon className={`w-4 h-4 shrink-0 ${c.tone}`} aria-hidden="true" />
            <div className="min-w-0">
              <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">{c.label}</p>
              <motion.p
                key={c.value}
                initial={{ opacity: 0.35, y: -3 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: i * 0.01 }}
                className={`text-[12px] font-extrabold tabular-nums ${c.tone}`}
              >
                {c.value}
              </motion.p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-4">
        {/* 3D GLOBE */}
        <GlassPanel title="ORBITAL VIEW // DOTTED WORLD MAP" subtitle="DRAG TO ROTATE — SCROLL TO ZOOM — CLICK A NODE" className="!p-0 overflow-hidden">
          <div className="relative h-[440px] sm:h-[560px] lg:h-[640px] scanlines">
            <Canvas
              camera={{ position: [0, 0.7, 7.4], fov: 40 }}
              dpr={[1, 2]}
              gl={{ antialias: true, alpha: true }}
              className="!absolute inset-0"
            >
              <GlobeScene
                selectedCode={selected.code}
                onSelect={selectRegion}
                showArcs={showArcs}
                showCables={showCables}
                autoRotate={autoRotate}
                focus={focus}
              />
            </Canvas>

            {/* HUD controls */}
            <div className="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1.5">
              <button
                type="button"
                onClick={toggleAutoRotate}
                className={toggleBtn(autoRotate)}
                aria-pressed={autoRotate}
              >
                <RotateCw className={`w-3 h-3 ${autoRotate ? "animate-spin" : ""}`} style={{ animationDuration: "3s" }} />
                AUTO-ROTATE {autoRotate ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => setShowArcs((v) => !v)}
                className={toggleBtn(showArcs)}
                aria-pressed={showArcs}
              >
                <Globe2 className="w-3 h-3" />
                INTER-REGION NET {showArcs ? "ON" : "OFF"}
              </button>
              <button
                type="button"
                onClick={() => setShowCables((v) => !v)}
                className={toggleBtn(showCables, "mint")}
                aria-pressed={showCables}
              >
                <Waves className="w-3 h-3" />
                UNDERSEA CABLES {showCables ? "ON" : "OFF"}
              </button>
            </div>

            {/* live pkts HUD */}
            <div className="absolute top-2.5 right-2.5 z-10 flex flex-col items-end gap-1.5">
              <div className="glass-inset px-2.5 py-1.5 text-right">
                <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">PKTS / SEC</p>
                <motion.p key={pkts} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-[11px] font-extrabold text-aws tabular-nums">
                  {pkts.toLocaleString("en-US")}
                </motion.p>
              </div>
              <div className="glass-inset px-2.5 py-1.5 text-right">
                <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">TRACE</p>
                <p className="text-[9px] font-bold text-magenta tabular-nums">
                  {selected.lat.toFixed(1)}° / {selected.lon.toFixed(1)}°
                </p>
              </div>
            </div>

            {/* AZ DETAIL — bottom-right, directly opposite TRACE (top-right) */}
            <div className="absolute bottom-2.5 right-2.5 z-10 glass-inset px-2.5 py-2 w-[150px] sm:w-[172px]">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[7px] uppercase tracking-[0.2em] text-muted-foreground">AZ DETAIL</p>
                <p className="text-[7px] font-bold text-neon tracking-[0.12em] truncate">
                  {selected.code.toUpperCase()}
                </p>
              </div>
              <div
                className="mt-1.5 flex flex-col gap-[5px] max-h-[104px] overflow-y-auto cyber-scroll"
                role="list"
                aria-label={`Availability zones in ${selected.code}`}
              >
                {azRows.map((az) => (
                  <div key={az.id} className="flex items-center gap-1.5" role="listitem" title={`${az.id} — ${az.load}% utilization`}>
                    <span className={`w-1.5 h-1.5 shrink-0 ${az.hot ? "bg-mint animate-pulse" : "bg-mint/60"}`} aria-hidden="true" />
                    <span className="text-[7.5px] font-bold text-foreground/85 w-[54px] truncate">{az.id}</span>
                    <span className="flex-1 h-[3px] bg-black/50 border border-foreground/10 overflow-hidden" aria-hidden="true">
                      <motion.span
                        key={`${az.id}-${az.load}`}
                        className="block h-full bg-mint/80"
                        initial={{ width: "18%" }}
                        animate={{ width: `${az.load}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </span>
                    <span className="text-[7px] text-mint tabular-nums w-[22px] text-right">{az.load}%</span>
                  </div>
                ))}
              </div>
            </div>

            {/* legend */}
            <div className="absolute bottom-2.5 left-2.5 z-10 glass-inset px-2.5 py-2 flex flex-col gap-1 text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-aws" /> CONTINENT DOT</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-neon" /> AVAILABILITY ZONES</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-white" /> CLOUDFRONT EDGE</span>
              <span className="flex items-center gap-1.5"><span className="w-1.5 h-1.5 bg-mint" /> SUBMARINE CABLE</span>
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-magenta" /> {showCables ? "SELECTED REGION" : "SELECTED + UPLINK BEAM"}
              </span>
            </div>
          </div>
        </GlassPanel>

        {/* SIDE: selected region + continent-filtered region list */}
        <div className="flex flex-col gap-4">
          <GlassPanel title="REGION UPLINK" subtitle={`TARGET: ${selected.code.toUpperCase()}`} deep className="!p-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={selected.code}
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ duration: 0.3 }}
                className="p-4"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-extrabold text-aws text-glow tracking-[0.12em]">{selected.code.toUpperCase()}</span>
                  <span className="flex items-center gap-1.5 text-[8px] uppercase tracking-[0.2em] text-mint">
                    <span className="w-1.5 h-1.5 bg-mint animate-pulse" /> ONLINE
                  </span>
                </div>
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-magenta" /> {selected.city}
                </p>

                <div className="grid grid-cols-3 gap-1.5 mt-3">
                  <div className="glass-inset p-1.5">
                    <p className="text-[6.5px] uppercase tracking-wider text-muted-foreground">SINCE</p>
                    <p className="text-xs font-extrabold text-foreground">{selected.since}</p>
                  </div>
                  <div className="glass-inset p-1.5">
                    <p className="text-[6.5px] uppercase tracking-wider text-muted-foreground">AZs</p>
                    <p className="text-xs font-extrabold text-aws">{selected.azs}</p>
                  </div>
                  <div className="glass-inset p-1.5">
                    <p className="text-[6.5px] uppercase tracking-wider text-muted-foreground">PING</p>
                    <motion.p key={latency} initial={{ opacity: 0.4 }} animate={{ opacity: 1 }} className="text-xs font-extrabold text-mint tabular-nums">
                      {latency}ms
                    </motion.p>
                  </div>
                </div>

                <div className="mt-3 flex gap-1">
                  {Array.from({ length: selected.azs }).map((_, i) => (
                    <motion.span
                      key={i}
                      initial={{ scaleY: 0.2, opacity: 0.3 }}
                      animate={{ scaleY: 1, opacity: 1 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex-1 h-1.5 bg-mint/70 shadow-[0_0_8px_rgba(0,255,163,0.5)]"
                      title={`AZ: ${selected.code}${String.fromCharCode(97)} (${i + 1})`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
                  {selected.azs} ISOLATED AVAILABILITY ZONES — EACH A SEPARATE DATA CENTER CLUSTER
                </p>

                {/* region throughput bar — runtime detail */}
                <div className="mt-3">
                  <div className="flex items-center justify-between text-[7px] uppercase tracking-[0.2em] text-muted-foreground">
                    <span>EGRESS THROUGHPUT</span>
                    <span className="text-aws tabular-nums">{(2 + Math.abs(selected.lat) / 18).toFixed(1)} Gbps</span>
                  </div>
                  <div className="mt-1 h-1.5 glass-inset overflow-hidden">
                    <motion.div
                      key={`${selected.code}-egress`}
                      className="h-full bg-aws/80"
                      initial={{ width: "12%" }}
                      animate={{ width: `${45 + Math.abs(selected.lat) * 0.6}%` }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </GlassPanel>

          <GlassPanel
            title="ALL REGIONS"
            subtitle={`${filteredRegions.length}/${REGIONS.length} NODES TRACKED`}
            className="!p-0 flex-1 min-h-0 flex flex-col"
          >
            {/* continent filter badges — ALL selected by default */}
            <div
              className="px-2 pt-2 pb-1.5 flex flex-wrap gap-1 border-b border-foreground/10"
              role="tablist"
              aria-label="Filter regions by geography"
            >
              {CONTINENT_FILTERS.map((c) => {
                const active = cont === c.id;
                const count =
                  c.id === "ALL" ? REGIONS.length : REGIONS.filter((r) => r.continent === c.id).length;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => selectCont(c.id)}
                    title={`${count} region${count === 1 ? "" : "s"}`}
                    className={`flex items-center gap-1 px-1.5 py-1 text-[7px] font-bold uppercase tracking-[0.14em] border backdrop-blur-md transition-colors ${
                      active
                        ? "border-aws/70 bg-aws/15 text-aws shadow-[0_0_12px_rgba(255,153,0,0.35)]"
                        : "border-foreground/15 bg-black/40 text-muted-foreground hover:border-aws/40 hover:text-aws"
                    }`}
                  >
                    {c.label}
                    <span className={`tabular-nums ${active ? "text-aws/80" : "opacity-60"}`}>{count}</span>
                  </button>
                );
              })}
            </div>

            {/* region list — expands to cover the retired LIVE OPS FEED height */}
            <div
              className="p-2 flex-1 min-h-0 max-h-[440px] overflow-y-auto cyber-scroll flex flex-col gap-1"
              role="list"
              aria-label="AWS regions"
            >
              <AnimatePresence initial={false} mode="popLayout">
                {filteredRegions.map((r) => (
                  <motion.button
                    layout
                    key={r.code}
                    type="button"
                    role="listitem"
                    onClick={() => selectRegion(r)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className={`flex items-center gap-2 px-2 py-1.5 text-left border transition-colors ${
                      r.code === selected.code
                        ? "border-aws/60 bg-aws/10 text-aws"
                        : "border-transparent text-muted-foreground hover:border-aws/25 hover:bg-aws/[0.04] hover:text-aws"
                    }`}
                  >
                    <AWSIconTile src={AWS_EXTRA_ICONS.region} className="w-3.5 h-3.5 shrink-0" alt="" />
                    <span className="text-[9px] font-bold tracking-[0.1em] flex-1">{r.code}</span>
                    <span className="text-[7px] uppercase tracking-wider opacity-70">{r.name}</span>
                    <span className="text-[7px] text-neon tabular-nums" title="Availability Zones">{r.azs}az</span>
                    <ChevronRight className="w-3 h-3 opacity-50" />
                  </motion.button>
                ))}
              </AnimatePresence>
            </div>
          </GlassPanel>
        </div>
      </div>

      {/* KNOWLEDGE GRID */}
      <div className="grid md:grid-cols-3 gap-3">
        <Callout type="info" title="Region = geographic cluster">
          A Region is a physical location with multiple, isolated Availability Zones. Data is not
          replicated across Regions unless you configure it — choose Regions for latency, cost and
          compliance.
        </Callout>
        <Callout type="tip" title="AZ = your high-availability unit" delay={0.05}>
          Availability Zones are physically separate data centers with independent power, cooling and
          networking, connected by low-latency fiber. Spread instances across 2+ AZs to survive
          data-center failure.
        </Callout>
        <Callout type="exam" title="Edge locations ≠ Regions" delay={0.1}>
          CloudFront edge locations (600+) cache content close to users — they are NOT Regions and
          can&apos;t run EC2. Exams love this distinction. More PoPs = lower Time-To-First-Byte.
        </Callout>
      </div>
        </>
      )}

      {tab === "REGIONS" && <RegionsUseCase />}
      {tab === "AZ" && <AzUseCase />}
    </div>
  );
}
