#!/usr/bin/python

# Load Google Analytics fact table
import lyf, logging
import argparse
import csv
import os

from lyf import psql
from datetime import date, timedelta, datetime	# Date time
from dateutil.parser import parse	# Date parser

parser = argparse.ArgumentParser(description="Extract Google Analytics Dimensions")
parser.add_argument("-f", "--full", action='store_true', default=False, help="Specifies full mode for extract as opposed to incremental.")

args = parser.parse_args()
FULL_MODE = args.full

def check_id(val, key, query, record, db):
    if (val != '(not set)'):
        query_results = db.query(query, [val])
        if (len(query_results) == 0):
            record[key] = -1
        else:
            record[key] = query_results[0][key]
    else:
        record[key] = -1
    return(record)

def main():
    try:
        file = os.path.join(lyf.SCRIPT_DIR, lyf.get_config('ETL', 'GA_Dims'))
        end_date = date.today().strftime('%Y-%m-%d')

        db = psql.DB()

        if FULL_MODE:
            db.truncate('lyf.f_ga_daily')
            start_date = lyf.get_config('ETL', 'Extract_Date')
        else:
            db.delete('f_ga_daily', { 'date_id' : date.today().strftime('%Y%m%d')})
            start_date = end_date

        service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
        metrics = 'ga:sessions,ga:bounces,ga:bounceRate,ga:avgSessionDuration,ga:sessionDuration,ga:pageviews,ga:timeOnPage'
        dims = 'ga:date,ga:cityId,ga:sourceMedium,ga:pageTitle,ga:longitude,ga:latitude,ga:userType'
        results = lyf.ga_query(service, start_date, end_date, metrics, dims)

        success = 0
        for row in results:
            rec = {}
            rec['date_id'] = row[0]
            rec = check_id(row[1], 'geo_id', 'select geo_id from lyf.d_ga_geo where city_id = %s;', rec, db)
            rec = check_id(row[2], 'source_id', 'select source_id from lyf.d_ga_source where source_medium = %s;', rec, db)
            rec = check_id(row[3], 'page_id', 'select page_id from lyf.d_ga_page where page_title = %s;', rec, db)
            rec['longitude'] = row[4]
            rec['latitude'] = row[5]
            rec['user_type'] = row[6]
            rec['sessions'] = row[7]
            rec['bounces'] = row[8]
            rec['bounce_rate'] = row[9]
            rec['avg_session_duration'] = row[10]
            rec['session_duration'] = row[11]
            rec['page_views'] = row[12]
            rec['time_on_page'] = row[13]

            status = db.insert('f_ga_daily', rec)
            if (status == 1):
                success += 1

        logging.info('Inserted %s/%s fact records into f_ga_daily.' % (success, len(results)))
        db.close()
    except Exception as err:
		logging.error(err)
if __name__ == '__main__':
	main()
