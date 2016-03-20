#! /usr/bin/env python
# LYF data integration function library

import lyf, logging
import MySQLdb
import codecs

# MySQL database connection
def connect():
	mysql_user = lyf.get_config('MYSQL', 'Username')
	mysql_pw = lyf.get_config('MYSQL', 'Password')
	mysql_host = lyf.get_config('MYSQL', 'Hostname')
	mysql_db = lyf.get_config('MYSQL', 'Database')
	
	conn = MySQLdb.connect(host=mysql_host, user=mysql_user, passwd=mysql_pw, db=mysql_db, \
		charset='utf8', init_command='SET NAMES UTF8')
	return(conn)

# Insert row into table, updating on duplicate keys
def merge_into_table(db, table, row, keys):

	# UTF-8 encode all rows
	for col in row:
		if type(row[col]) is str:
			row[col] = row[col].encode('utf-8')
	
	sql = 'INSERT INTO %s (\n' % table
	
	sql += ','.join(row.keys())
	sql += '\n) VALUES (\n'
	
	insert_values = []
	for col in row:
		insert_values.append("'%s'" % str(row[col]).replace("'","''"))
	sql += ','.join(insert_values)
	
	sql += ') ON DUPLICATE KEY UPDATE \n'
	
	update_values = []
	for col in row:
		if (col not in keys):
			update = '%s=%s' % (col, "'%s'" % str(row[col]).replace("'","''"))
			update_values.append(update)
			
	sql += ','.join(update_values)
	sql += ';'
	
	db.query(sql)
	db.commit()

# Truncate table
def truncate(db, table):
	sql = 'TRUNCATE TABLE %s;' % table
	db.query(sql)
	
# Load Google Analytics dimension table
def load_ga_dim(full_mode, table, ga_dims, columns, keys):
	try:
		end_date = date.today().strftime('%Y-%m-%d') # Fetch up to today
		db = connect() # Connect to DB
		
		if full_mode:
			sql.truncate(db, table, ga_dims)
			start_date = lyf.get_config('ETL', 'Extract_Date')
		else:
			start_date = end_date
	
		# Connect to Google Analytics
		service = lyf.google_api('analytics', 'v3', ['https://www.googleapis.com/auth/analytics.readonly'])
		metrics = 'ga:sessions'
		dims = ga_dims
		results = lyf.ga_query(service, start_date, end_date, metrics, dims)
	
		# Check if there are rows
		if results.has_key('rows'):
			for row in results['rows']:
				rec = {}
				i = 0
				for key in columns:
					rec[columns[key]] = row[i]
					i += 1
				print(rec, keys)
				# sql.merge_into_table(db, table, rec, keys)
	
		db.close()
		logging.info('Successfully loaded %s from %s to %s.' % (table, start_date, end_date))
	except Exception as err:
		logging.error(err)