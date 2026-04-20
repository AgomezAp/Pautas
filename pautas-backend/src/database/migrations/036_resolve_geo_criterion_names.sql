-- Resolver Geo Criterion IDs a nombres legibles en google_ads_geo_snapshots
-- Estos IDs provienen de Google Ads geographic_view y no fueron resueltos por la API
-- IDs basados en patrón 2000 + ISO 3166-1 numérico

-- First merge duplicates: sum metrics for rows with same campaign where both Geo:XXXX and resolved name exist
-- Then update remaining Geo:XXXX rows

-- Delete Geo:XXXX rows where a resolved name row already exists for the same campaign+date
DELETE FROM google_ads_geo_snapshots g1
WHERE g1.geo_target_name LIKE 'Geo:%'
AND EXISTS (
  SELECT 1 FROM google_ads_geo_snapshots g2
  WHERE g2.campaign_id = g1.campaign_id
  AND g2.snapshot_date = g1.snapshot_date
  AND g2.geo_target_name NOT LIKE 'Geo:%'
);

-- Now update remaining Geo:XXXX rows (no conflict possible)

UPDATE google_ads_geo_snapshots SET geo_target_name = 'Argentina' WHERE geo_target_name = 'Geo:2032';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Bolivia' WHERE geo_target_name = 'Geo:2068';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Brasil' WHERE geo_target_name = 'Geo:2076';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Chile' WHERE geo_target_name = 'Geo:2152';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Colombia' WHERE geo_target_name = 'Geo:2170';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Costa Rica' WHERE geo_target_name = 'Geo:2188';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Cuba' WHERE geo_target_name = 'Geo:2192';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Ecuador' WHERE geo_target_name = 'Geo:2218';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'El Salvador' WHERE geo_target_name = 'Geo:2222';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Guatemala' WHERE geo_target_name = 'Geo:2320';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Honduras' WHERE geo_target_name = 'Geo:2340';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'México' WHERE geo_target_name = 'Geo:2484';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Nicaragua' WHERE geo_target_name = 'Geo:2558';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Panamá' WHERE geo_target_name = 'Geo:2591';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Paraguay' WHERE geo_target_name = 'Geo:2600';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Perú' WHERE geo_target_name = 'Geo:2604';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'República Dominicana' WHERE geo_target_name = 'Geo:2214';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Uruguay' WHERE geo_target_name = 'Geo:2858';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Venezuela' WHERE geo_target_name = 'Geo:2862';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'España' WHERE geo_target_name = 'Geo:2724';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Estados Unidos' WHERE geo_target_name = 'Geo:2840';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'China' WHERE geo_target_name = 'Geo:2156';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'India' WHERE geo_target_name = 'Geo:2356';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Reino Unido' WHERE geo_target_name = 'Geo:2826';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Alemania' WHERE geo_target_name = 'Geo:2276';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Francia' WHERE geo_target_name = 'Geo:2250';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Italia' WHERE geo_target_name = 'Geo:2380';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Japón' WHERE geo_target_name = 'Geo:2392';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Canadá' WHERE geo_target_name = 'Geo:2124';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Australia' WHERE geo_target_name = 'Geo:2036';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Corea del Sur' WHERE geo_target_name = 'Geo:2410';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Taiwán' WHERE geo_target_name = 'Geo:2158';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Bélgica' WHERE geo_target_name = 'Geo:2056';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Países Bajos' WHERE geo_target_name = 'Geo:2528';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Suiza' WHERE geo_target_name = 'Geo:2756';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Rusia' WHERE geo_target_name = 'Geo:2643';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Turquía' WHERE geo_target_name = 'Geo:2792';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Egipto' WHERE geo_target_name = 'Geo:2818';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Sudáfrica' WHERE geo_target_name = 'Geo:2710';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Arabia Saudita' WHERE geo_target_name = 'Geo:2682';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Israel' WHERE geo_target_name = 'Geo:2376';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Tailandia' WHERE geo_target_name = 'Geo:2764';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Vietnam' WHERE geo_target_name = 'Geo:2704';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Indonesia' WHERE geo_target_name = 'Geo:2360';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Malasia' WHERE geo_target_name = 'Geo:2458';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Filipinas' WHERE geo_target_name = 'Geo:2608';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Singapur' WHERE geo_target_name = 'Geo:2702';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Chipre' WHERE geo_target_name = 'Geo:2196';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Grecia' WHERE geo_target_name = 'Geo:2300';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Polonia' WHERE geo_target_name = 'Geo:2616';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Portugal' WHERE geo_target_name = 'Geo:2620';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Chequia' WHERE geo_target_name = 'Geo:2203';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Hungría' WHERE geo_target_name = 'Geo:2348';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Austria' WHERE geo_target_name = 'Geo:2040';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Suecia' WHERE geo_target_name = 'Geo:2752';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Noruega' WHERE geo_target_name = 'Geo:2578';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Dinamarca' WHERE geo_target_name = 'Geo:2208';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Finlandia' WHERE geo_target_name = 'Geo:2246';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Irlanda' WHERE geo_target_name = 'Geo:2372';
UPDATE google_ads_geo_snapshots SET geo_target_name = 'Nueva Zelanda' WHERE geo_target_name = 'Geo:2554';
