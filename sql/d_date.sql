DROP PROCEDURE IF EXISTS pop_dates;
DELIMITER |
CREATE PROCEDURE pop_dates(dateStart DATE, dateEnd DATE)
BEGIN
  WHILE dateStart <= dateEnd DO
    INSERT INTO d_date (
		DATE_ID,
		DT,
		YEAR_NAME,
		YYYYMM,
		SHORT_MONTH_NAME,
		MONTH_NAME,
		MONTH_NUM,
		DAY_OF_YEAR,
		DAY_OF_MONTH,
		DAY_OF_WEEK,
		SHORT_DAY_OF_WEEK
	) VALUES (
		DATE_FORMAT(dateStart, '%Y%m%d'),
		dateStart,
		DATE_FORMAT(dateStart, '%Y'),
		DATE_FORMAT(dateStart, '%Y%m'),
		DATE_FORMAT(dateStart, '%b'),
		DATE_FORMAT(dateStart, '%M'),
		DATE_FORMAT(dateStart, '%c'),
		DATE_FORMAT(dateStart, '%j'),
		DATE_FORMAT(dateStart, '%e'),
		DATE_FORMAT(dateStart, '%W'),
		DATE_FORMAT(dateStart, '%a')
	);
    SET dateStart = date_add(dateStart, INTERVAL 1 DAY);
  END WHILE;
  COMMIT;
END;
|
DELIMITER;
CALL pop_dates('2016-01-01','2016-01-31');

