-- Date dimension
DROP TABLE IF EXISTS lyf.d_date;
CREATE TABLE lyf.d_date AS (
	SELECT
		datum AS DATE,
		CAST(to_char(datum,'yyyymmdd') AS integer) AS date_id,
		EXTRACT(YEAR FROM datum) AS year,
		EXTRACT(MONTH FROM datum) AS month_num,
		-- Localized month name
		to_char(datum, 'Month') AS month_name,
		to_char(datum, 'Mon') AS short_month_name, 
		EXTRACT(DAY FROM datum) AS day_of_month,
		EXTRACT(doy FROM datum) AS day_of_year,
		-- Localized weekday
		to_char(datum, 'Day') AS day_name,
		to_char(datum, 'Dy') AS short_day_name,
		-- ISO calendar week
		EXTRACT(week FROM datum) AS week_of_year,
		'Q' || to_char(datum, 'Q') AS quarter,
		CAST(to_char(datum,'yyyymm') AS integer) AS yyyymm,
		to_char(datum, 'yyyy "Q"Q') AS year_quarter,
		to_char(datum, 'yyyy-mm') AS year_month,
		-- ISO calendar year and week
		to_char(datum, 'iyyy-IW') AS year_calendar_week,
		-- Weekend
		CASE WHEN EXTRACT(isodow FROM datum) IN (6, 7) THEN 'Weekend' ELSE 'Weekday' END AS weekend,
		-- ISO start and end of the week of this date
		datum + (1 - EXTRACT(isodow FROM datum))::INTEGER AS week_start,
		datum + (7 - EXTRACT(isodow FROM datum))::INTEGER AS week_end,
		-- Start and end of the month of this date
		datum + (1 - EXTRACT(DAY FROM datum))::INTEGER AS month_start,
		(datum + (1 - EXTRACT(DAY FROM datum))::INTEGER + '1 month'::INTERVAL)::DATE - '1 day'::INTERVAL AS month_end
	FROM (
		-- Range should be number of days in the range, accounting for leap years
		SELECT '2016-01-01'::DATE + SEQUENCE.DAY AS datum
		FROM generate_series(0,731) AS SEQUENCE(DAY)
		GROUP BY SEQUENCE.DAY
	     ) DQ
);

-- Time dimension
DROP TABLE IF EXISTS lyf.d_time;
CREATE TABLE lyf.d_time AS (
	SELECT to_char(MINUTE, 'hh24:mi') AS time_of_day,
		-- Hour of the day (0 - 23)
		EXTRACT(HOUR FROM MINUTE) AS hour, 
		-- Extract and format quarter hours
		to_char(MINUTE - (EXTRACT(MINUTE FROM MINUTE)::INTEGER % 15 || 'minutes')::INTERVAL, 'hh24:mi') ||
		' – ' ||
		to_char(MINUTE - (EXTRACT(MINUTE FROM MINUTE)::INTEGER % 15 || 'minutes')::INTERVAL + '14 minutes'::INTERVAL, 'hh24:mi')
			AS quarter_hour,
		-- Minute of the day (0 - 1439)
		EXTRACT(HOUR FROM MINUTE)*60 + EXTRACT(MINUTE FROM MINUTE) AS minute,
		-- Names of day periods
		CASE WHEN to_char(MINUTE, 'hh24:mi') BETWEEN '06:00' AND '08:29'
			THEN 'Morning'
		     WHEN to_char(MINUTE, 'hh24:mi') BETWEEN '08:30' AND '11:59'
			THEN 'AM'
		     WHEN to_char(MINUTE, 'hh24:mi') BETWEEN '12:00' AND '17:59'
			THEN 'PM'
		     WHEN to_char(MINUTE, 'hh24:mi') BETWEEN '18:00' AND '22:29'
			THEN 'Evening'
		     ELSE 'Night'
		END AS period,
		-- Indicator of day or night
		CASE WHEN to_char(MINUTE, 'hh24:mi') BETWEEN '07:00' AND '19:59' THEN 'Day'
		     ELSE 'Night'
		END AS day_night
	FROM (SELECT '0:00'::TIME + (SEQUENCE.MINUTE || ' minutes')::INTERVAL AS MINUTE
		FROM generate_series(0,1439) AS SEQUENCE(MINUTE)
		GROUP BY SEQUENCE.MINUTE
	     ) DQ
);

-- Twitter fact - Daily snapshot
DROP TABLE IF EXISTS lyf.f_twitter_daily;
CREATE TABLE IF NOT EXISTS lyf.f_twitter_daily (
	date_id INTEGER NOT NULL,
	total_followers INTEGER,
	total_following INTEGER,
	total_tweets INTEGER,
	followers INTEGER,
	following INTEGER,
	tweets INTEGER,
	PRIMARY KEY (date_id)
);

-- Youtube fact - Daily snapshot
DROP TABLE IF EXISTS lyf.f_youtube_daily;
CREATE TABLE lyf.f_youtube_daily (
	date_id INT NOT NULL,
	video_id VARCHAR(20) NOT NULL,
	title VARCHAR(255) NULL,
	total_views INT NULL,
	views INT NULL,
	total_likes INT NULL,
	likes INT NULL,
	total_dislikes INT NULL,
	dislikes INT NULL,
	publish_date DATE NULL,
	channel VARCHAR(20) NULL,
	PRIMARY KEY (date_id, video_id)
);

-- Google Analytics Dimensions
-- Source
DROP TABLE IF EXISTS lyf.d_ga_source;
CREATE TABLE lyf.d_ga_source (
	source_id SERIAL,
	source VARCHAR(100) NOT NULL DEFAULT 'None',
	medium VARCHAR(20) NOT NULL DEFAULT 'None',
	social_network VARCHAR(20) NULL DEFAULT 'None',
	PRIMARY KEY (source, medium)
);

-- Platform
DROP TABLE IF EXISTS lyf.d_ga_platform;
CREATE TABLE lyf.d_ga_platform (
  platform_id SERIAL,
  browser VARCHAR(20) NOT NULL DEFAULT 'None',
  os VARCHAR(20) NOT NULL DEFAULT 'None',
  os_version VARCHAR(20) NOT NULL DEFAULT 'None',
  device_category VARCHAR(20) NOT NULL DEFAULT 'None',
  PRIMARY KEY (browser, os, os_version, device_category)
)

-- Geography
DROP TABLE IF EXISTS lyf.d_ga_geo;
CREATE TABLE lyf.d_ga_geo (
	geo_id SERIAL,
	continent VARCHAR(20) NULL,
	sub_continent VARCHAR(40) NULL,
	country VARCHAR(40) NULL,
	region VARCHAR(45) NOT NULL DEFAULT 'None',
	city VARCHAR(45) NOT NULL DEFAULT 'None',
	latitude FLOAT NOT NULL DEFAULT 0.0000,
	longitude FLOAT NOT NULL DEFAULT 0.0000,
	PRIMARY KEY (region, city, latitude, longitude)
);
